import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { redisIncr } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';

export const maxDuration = 10;

// Piston API types
export type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp';

interface ExecuteRequest {
    language: SupportedLanguage;
    code: string;
    stdin?: string;
}

interface ExecuteResponse {
    stdout: string;
    stderr: string;
    exit_code: number;
    runtime_ms: number;
}

interface PistonResponse {
    language: string;
    version: string;
    run: {
        stdout: string;
        stderr: string;
        output: string;
        code: number;
        signal: string | null;
    };
    compile?: {
        stdout: string;
        stderr: string;
        output: string;
        code: number;
        signal: string | null;
    };
}

const LANGUAGE_MAP: Record<SupportedLanguage, { language: string; version: string }> = {
    python: { language: 'python', version: '3.10.0' },
    javascript: { language: 'javascript', version: '18.15.0' },
    java: { language: 'java', version: '15.0.2' },
    cpp: { language: 'c++', version: '10.2.0' }
};

const EXEC_RATE_LIMIT = 10;
const EXEC_RATE_WINDOW_SECONDS = 60;

export async function POST(req: NextRequest) {
    try {
        // 1. Auth check
        const supabase = await createServerSupabase();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse request body
        let body: ExecuteRequest;
        try {
            const rawBody = await req.text();
            body = JSON.parse(rawBody) as ExecuteRequest;
        } catch {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const { language, code, stdin } = body;

        if (!language || !code || !LANGUAGE_MAP[language]) {
            return NextResponse.json({ error: 'Invalid or missing language or code parameters' }, { status: 400 });
        }

        if (code.length > 100_000) {
            return NextResponse.json({ error: 'Code exceeds maximum length (100KB)' }, { status: 413 });
        }
        if ((stdin || '').length > 10_000) {
            return NextResponse.json({ error: 'Input exceeds maximum length (10KB)' }, { status: 413 });
        }

        // 3. Rate limiting (10 executions per minute per user)
        const rateLimitKey = `exec:${user.id}:rpm`;

        let currentUsage: number;
        try {
            currentUsage = await redisIncr(rateLimitKey, EXEC_RATE_WINDOW_SECONDS);
            if (currentUsage === 0) {
                // Redis returned 0 — could be error or genuinely first request
                // Treat as allowed but log for monitoring
                console.warn('[Execute] Redis returned 0 for rate limit key — Redis may be unavailable');
            }
        } catch (redisError) {
            console.error('[Execute] Redis unavailable for rate limiting:', redisError);
            // Fail closed: if we can't check rate limit, deny the request
            return NextResponse.json(
                { error: 'Rate limiting service temporarily unavailable. Please try again in a moment.' },
                { status: 503 }
            );
        }

        if (currentUsage > EXEC_RATE_LIMIT) {
            return NextResponse.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429 });
        }

        // 4. Prepare Piston Request
        // PISTON_URL should be the full execute endpoint (e.g. https://emkc.org/api/v2/piston/execute)
        const pistonExecuteUrl = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston/execute';
        const config = LANGUAGE_MAP[language];

        const pistonPayload = {
            language: config.language,
            version: config.version,
            files: [{ name: 'main', content: code }],
            stdin: stdin || '',
            run_timeout: 5000,
            compile_timeout: 5000,
            compile_memory_limit: -1,
            run_memory_limit: 65536
        };

        const startTime = Date.now();
        let pistonResponseJson: PistonResponse | null = null;

        // 5. Call Piston API with AbortSignal timeout
        try {
            const abortController = new AbortController();
            const signal = abortController.signal;
            const timeoutId = setTimeout(() => abortController.abort(), 8000);

            const result = await fetch(pistonExecuteUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pistonPayload),
                signal
            });

            clearTimeout(timeoutId);

            if (!result.ok) {
                const errorText = await result.text().catch(() => 'No response body');
                console.error(`Piston API Error (${result.status}): ${errorText.substring(0, 200)}`);
                throw new Error(`Piston API Error: ${result.status}`);
            }

            pistonResponseJson = await result.json() as PistonResponse;
        } catch (error: unknown) {
            const isTimeout = error instanceof DOMException && error.name === 'AbortError';

            if (isTimeout) {
                void logSystemEvent({
                    type: 'piston_error',
                    errorMessage: 'Piston API Timeout',
                    metadata: { language, userId: user.id }
                });
                const response: ExecuteResponse = {
                    stdout: '',
                    stderr: 'Execution timed out (10s limit)',
                    exit_code: 1,
                    runtime_ms: 10000
                };
                return NextResponse.json(response, { status: 200 }); // Handled timeout is 200 to client
            }

            void logSystemEvent({
                type: 'piston_error',
                errorMessage: error instanceof Error ? error.message : String(error),
                metadata: { language, userId: user.id }
            });
            return NextResponse.json({ error: 'Code execution service unavailable' }, { status: 503 });
        }

        // 6. Map response to return to client
        const runtime = Date.now() - startTime;

        // Compilation error handling (Piston sometimes puts errors in compile.stderr, sometimes in run.stderr)
        let stderr = pistonResponseJson.run.stderr;
        if (!stderr && pistonResponseJson.compile && pistonResponseJson.compile.code !== 0) {
            stderr = pistonResponseJson.compile.stderr;
        }

        // Output priority: Piston run.code -> compile.code if compile failed
        let exitCode = pistonResponseJson.run.code;
        if (pistonResponseJson.compile && pistonResponseJson.compile.code !== 0) {
            exitCode = pistonResponseJson.compile.code;
        }

        const outResponse: ExecuteResponse = {
            stdout: pistonResponseJson.run.stdout || '',
            stderr: stderr || '',
            exit_code: exitCode ?? 1, // Fallback if somehow missing
            runtime_ms: runtime
        };

        return NextResponse.json(outResponse);

    } catch (globalError: unknown) {
        console.error('Execute route critical error:', globalError);
        return NextResponse.json(
            { error: 'Internal server error processing execution request.' },
            { status: 500 }
        );
    }
}
