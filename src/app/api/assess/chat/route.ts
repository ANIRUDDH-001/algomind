import { NextRequest, NextResponse } from 'next/server';
import { getAIClient } from '@/lib/ai/client';
import * as jose from 'jose';
import { validateEnv } from '@/lib/startup/validateEnv';
import { getRedis } from '@/lib/upstash/client';

validateEnv();

const MESSAGE_LIMIT = 30; // Max AI turns per assessment session

export async function POST(req: NextRequest) {
    try {
        interface ChatRequestBody {
            sessionToken: string;
            messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
            systemPrompt?: string;
            problemContext?: {
                title?: string;
                content?: string;
            };
        }

        let body: ChatRequestBody;
        try {
            const text = await req.text();
            body = JSON.parse(text);
        } catch (_parseError) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const { sessionToken, messages, systemPrompt } = body;

        if (!sessionToken) {
            return NextResponse.json({ error: 'Missing session token' }, { status: 401 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('[Security] SUPABASE_SERVICE_ROLE_KEY is not set — refusing to verify JWT');
            return NextResponse.json(
                { error: 'Server misconfiguration. Contact administrator.' },
                { status: 500 }
            );
        }
        const secret = new TextEncoder().encode(serviceKey);

        // 🔒 Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Chat API] Invalid session token', error);
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
        }

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
        }

        // ── Per-session message rate limit ────────────────────────────────────
        const submissionId = payload.submissionId as string;
        const redis = getRedis();
        let currentCount = 0;

        if (redis && submissionId) {
            const messageCountKey = `assess:${submissionId}:msgCount`;
            currentCount = await redis.incr(messageCountKey);

            if (currentCount === 1) {
                // First message — synchronize TTL with remaining JWT lifetime so the
                // counter expires naturally when the session does.
                const jwtExp = payload.exp as number | undefined;
                const expirySeconds = jwtExp
                    ? Math.max(jwtExp - Math.floor(Date.now() / 1000), 60)
                    : 90 * 60; // fallback: 90 min
                await redis.expire(messageCountKey, expirySeconds);
            }

            if (currentCount > MESSAGE_LIMIT) {
                return NextResponse.json(
                    {
                        error: 'Message limit reached for this assessment session.',
                        limitReached: true,
                        messagesUsed: currentCount - 1,
                        messageLimit: MESSAGE_LIMIT,
                    },
                    { status: 429 }
                );
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        const client = getAIClient();

        let enhancedSystemPrompt = systemPrompt || '';

        // Add minimal instructions prioritizing standard assessment style
        enhancedSystemPrompt += '\n\n## CANDIDATE INTERVIEW GUIDELINES\nYou are conducting a technical interview. Keep your answers concise, ask probing questions about space/time complexity, and do not write the code for the candidate.';

        const result = await client.generateResponse(messages, {
            preferredModel: 'auto',
            category: 'speed',
            maxTokens: 4096,
            systemPrompt: enhancedSystemPrompt,
            estimatedTokens: 500
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate response');
        }

        const response = NextResponse.json({
            response: result.response,
            modelUsed: result.modelUsed,
            provider: result.provider
        });

        // Expose usage counters to the frontend (headers are visible via fetch)
        if (currentCount > 0) {
            response.headers.set('X-Messages-Used', String(currentCount));
            response.headers.set('X-Messages-Limit', String(MESSAGE_LIMIT));
        }

        return response;

    } catch (error: unknown) {
        console.error('❌ [Assess Chat API] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal Server Error' },
            { status: 500 }
        );
    }
}
