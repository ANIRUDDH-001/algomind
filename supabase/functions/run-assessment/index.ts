// Deno edge function — runs on Supabase Edge (not Node.js).
// TypeScript IDE errors about 'Deno' and 'esm.sh' imports are EXPECTED
// and harmless — this file is never compiled by the Next.js/Node.js tsconfig.
// It runs in the Supabase Deno runtime. Deploy with:
//   supabase functions deploy run-assessment --no-verify-jwt

// @ts-expect-error: Deno is not defined in Next.js tsconfig
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-expect-error: Deno URL imports are not resolved by Next.js tsconfig
import { timingSafeEqual } from 'https://deno.land/std@0.208.0/crypto/timing_safe_equal.ts';
// @ts-expect-error: Deno modules cannot have .ts extensions in Next.js; this runs in Deno runtime
import { parseGeminiResultText, type GeminiResult } from './analysis-parser.ts';

// @ts-expect-error: Deno is not defined in Next.js tsconfig
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-expect-error: Deno is not defined in Next.js tsconfig
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// @ts-expect-error: Deno is not defined in Next.js tsconfig
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface AnalysisRequest {
    submissionId: string;
    questionStates: Array<{
        problem_id: string;
        transcript: Array<{ speaker: string; text: string }>;
        elapsed_secs: number;
    }>;
    integrityFlags?: string[];
    candidateId?: string | null;
    retryConfig?: {
        maxAttempts?: number;
        backoffMs?: number[];
    };
}

function extractCandidateSecret(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7).trim();
    }

    return req.headers.get('x-internal-secret')?.trim() ?? null;
}

function secretsMatchTimingSafe(provided: string, expected: string): boolean {
    const encoder = new TextEncoder();
    const a = encoder.encode(provided);
    const b = encoder.encode(expected);

    if (a.byteLength !== b.byteLength) {
        return false;
    }

    return timingSafeEqual(a, b);
}

// @ts-expect-error: Deno is not defined in Next.js tsconfig
Deno.serve(async (req: Request) => {
    // Security: verify the request came from our Next.js app
    const providedSecret = extractCandidateSecret(req);
    // @ts-expect-error: Deno is not defined in Next.js tsconfig
    const expectedSecret = Deno.env.get('INTERNAL_API_SECRET')?.trim() ?? '';

    if (!providedSecret || !expectedSecret || !secretsMatchTimingSafe(providedSecret, expectedSecret)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    let body: AnalysisRequest;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const { submissionId, questionStates, integrityFlags, candidateId, retryConfig } = body;

    // Idempotency guard: if analysis already completed, return immediately
    const { data: currentStatus } = await supabase
        .from('candidate_submissions')
        .select('analysis_status')
        .eq('id', submissionId)
        .single();

    if (currentStatus?.analysis_status === 'completed') {
        return new Response(
            JSON.stringify({ success: true, idempotent: true, message: 'Analysis already completed' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    }

    if (!submissionId || !Array.isArray(questionStates)) {
        return new Response(JSON.stringify({ error: 'Missing submissionId or questionStates' }), { status: 400 });
    }

    // Mark analysis as triggered
    await supabase
        .from('candidate_submissions')
        .update({ analyze_triggered_at: new Date().toISOString() })
        .eq('id', submissionId);

    try {
        let totalScoreSum = 0;
        let totalWeightSum = 0;
        const skillTotals: Record<string, number> = {};
        const allFeedbacks: string[] = [];
        const allNextSteps: string[] = [];
        let combinedTranscript: Array<{ role: string; content: string }> = [];
        let primaryProblemId = '';
        let primaryProblemTitle = 'Multiple Problems';

        for (const qs of questionStates) {
            if (!qs.problem_id || !qs.transcript?.length) continue;

            const { data: problem } = await supabase
                .from('problems')
                .select('title, description, difficulty')
                .eq('id', qs.problem_id)
                .single();

            if (!problem) continue;

            primaryProblemId = qs.problem_id;
            primaryProblemTitle = problem.title;

            const normalizedTranscript = qs.transcript.map((t) => ({
                role: t.speaker === 'ai' ? 'assistant' : t.speaker as 'user' | 'assistant',
                content: t.text,
            }));
            combinedTranscript = [...combinedTranscript, ...normalizedTranscript];

            // Call Gemini directly (no CognitiveAnalyzer class — Deno can't import Next.js src/)
            const result = await runGeminiAnalysis({
                problem,
                transcript: normalizedTranscript,
                retryConfig,
            });

            const weight = Math.max(qs.elapsed_secs ?? 1, 1);
            totalScoreSum += result.overallScore * weight;
            totalWeightSum += weight;
            allFeedbacks.push(`**Problem: ${problem.title}**\n${result.overallFeedback}`);
            allNextSteps.push(...result.nextSteps);
            // Aggregate per-skill scores (weighted)
            for (const [skill, data] of Object.entries(result.skills)) {
                skillTotals[skill] = (skillTotals[skill] ?? 0) + data.score * weight;
            }
        }

        if (totalWeightSum === 0) totalWeightSum = 1;
        const overallScore = totalScoreSum / totalWeightSum;

        // Save interview session
        const { data: sessionData, error: sessionErr } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: candidateId ?? null,
                is_candidate_session: true,
                problem_id: primaryProblemId,
                problem_title: primaryProblemTitle,
                transcript: combinedTranscript,
                duration: questionStates.reduce((s, qs) => s + (qs.elapsed_secs ?? 0), 0),
                status: 'completed',
                overall_score: overallScore,
                completed_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (sessionErr) throw sessionErr;

        const w = totalWeightSum;
        // Save assessment
        const { error: assessErr } = await supabase.from('assessments').insert({
            session_id: sessionData.id,
            user_id: candidateId ?? null,
            overall_score: overallScore,
            overall_feedback: allFeedbacks.join('\n\n'),
            next_steps: allNextSteps.slice(0, 5),
            skill_evidence: {},
            problem_decomposition: (skillTotals['problem-decomposition'] ?? 0) / w,
            pattern_recognition: (skillTotals['pattern-recognition'] ?? 0) / w,
            algorithmic_thinking: (skillTotals['algorithmic-thinking'] ?? 0) / w,
            complexity_analysis: (skillTotals['complexity-analysis'] ?? 0) / w,
            communication_clarity: (skillTotals['communication-clarity'] ?? 0) / w,
            edge_case_awareness: (skillTotals['edge-case-awareness'] ?? 0) / w,
            optimization_mindset: (skillTotals['optimization-mindset'] ?? 0) / w,
            debugging_approach: (skillTotals['debugging-approach'] ?? 0) / w,
        });

        if (assessErr) throw assessErr;

        // Mark submission as completed
        await supabase
            .from('candidate_submissions')
            .update({
                status: 'completed',
                analysis_status: 'completed',
                session_id: sessionData.id,
                overall_score: overallScore,
                integrity_flags: integrityFlags ?? [],
                completed_at: new Date().toISOString(),
                analysis_error: null,
            })
            .eq('id', submissionId);

        return new Response(JSON.stringify({ success: true, overallScore }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isParseFailure = msg.startsWith('parse_failed:') || msg.includes('schema_invalid:');
        const analysisStatus = isParseFailure ? 'parse_failed' : 'failed';
        console.error('[run-assessment] Edge function error:', msg);

        // Mark deterministic terminal state so retries and dashboards can distinguish parse failures.
        await supabase
            .from('candidate_submissions')
            .update({
                analysis_status: analysisStatus,
                analysis_error: msg.slice(0, 500),
            })
            .eq('id', submissionId);

        await supabase
            .from('system_events')
            .insert({
                type: isParseFailure ? 'assessment_parse_failed' : 'assessment_analysis_failed',
                metadata: {
                    submission_id: submissionId,
                    error: msg.slice(0, 500),
                },
            });

        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

// ── Minimal Gemini Analysis (no CognitiveAnalyzer class dependency) ──────────

const GEMINI_MAX_RETRIES = 3;
const GEMINI_DEFAULT_BACKOFF_MS = [100, 500, 2000];

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableGeminiStatus(status: number): boolean {
    return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function runGeminiAnalysis({ problem, transcript, retryConfig }: {
    problem: { title: string; description: string; difficulty: string };
    transcript: Array<{ role: string; content: string }>;
    retryConfig?: {
        maxAttempts?: number;
        backoffMs?: number[];
    };
}): Promise<GeminiResult> {
    const maxAttempts = Math.max(1, Math.min(retryConfig?.maxAttempts ?? GEMINI_MAX_RETRIES, 4));
    const backoffMs = Array.isArray(retryConfig?.backoffMs) && retryConfig.backoffMs.length > 0
        ? retryConfig.backoffMs
        : GEMINI_DEFAULT_BACKOFF_MS;

    const transcriptText = transcript
        .map(t => `${t.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${t.content}`)
        .join('\n');

    const prompt = `You are an expert technical interview evaluator. Score this DSA interview.

Problem: ${problem.title} (${problem.difficulty})
${problem.description?.slice(0, 800) ?? ''}

Transcript:
${transcriptText.slice(0, 14000)}

Respond ONLY with valid JSON matching this schema exactly:
{
    "overallScore": <number 0-10>,
  "overallFeedback": "<2-3 sentence assessment>",
  "nextSteps": ["<step 1>", "<step 2>", "<step 3>"],
  "skills": {
    "problem-decomposition": { "score": <0-10>, "evidence": "<brief>" },
    "pattern-recognition": { "score": <0-10>, "evidence": "<brief>" },
    "algorithmic-thinking": { "score": <0-10>, "evidence": "<brief>" },
    "complexity-analysis": { "score": <0-10>, "evidence": "<brief>" },
    "communication-clarity": { "score": <0-10>, "evidence": "<brief>" },
    "edge-case-awareness": { "score": <0-10>, "evidence": "<brief>" },
    "optimization-mindset": { "score": <0-10>, "evidence": "<brief>" },
    "debugging-approach": { "score": <0-10>, "evidence": "<brief>" }
  }
}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const timeoutSignal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
                ? AbortSignal.timeout(45000)
                : undefined;

            const resp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 },
                    }),
                    signal: timeoutSignal,
                }
            );

            if (!resp.ok) {
                const body = await resp.text();
                const retryable = isRetryableGeminiStatus(resp.status) && attempt < maxAttempts;
                console.error(
                    `[run-assessment] Gemini error (attempt ${attempt}/${maxAttempts}):`,
                    resp.status,
                    body
                );

                if (retryable) {
                    const wait = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 2000;
                    await sleep(wait);
                    continue;
                }

                throw new Error(`analysis_failed: gemini_http_${resp.status}`);
            }

            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
            return parseGeminiResultText(text);
        } catch (err) {
            const shouldRetry = attempt < maxAttempts;
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[run-assessment] Gemini parse/network error (attempt ${attempt}/${maxAttempts}):`, message);
            if (!shouldRetry) {
                throw new Error(message.startsWith('parse_failed:') || message.startsWith('schema_invalid:') ? message : `analysis_failed: ${message}`);
            }

            const wait = backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 2000;
            await sleep(wait);
        }
    }

    throw new Error('analysis_failed: unknown');
}
