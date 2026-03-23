import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { retryWithBackoff } from '@/lib/utils/retry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        const ip =
            req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            req.headers.get('x-real-ip') ||
            'unknown';
        const { checkIpRateLimit } = await import('@/lib/rate-limit/ip-rate-limiter');
        const rateCheck = await checkIpRateLimit(ip, {
            maxRequests: 20,
            windowSeconds: 60,
            endpoint: 'whisper_guest',
        });
        if (!rateCheck.success) {
            return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
        }
    }

    // Check if Whisper is enabled globally
    const whisperEnabled = await getGlobalFeatureFlag('ENABLE_WHISPER_STT');
    if (!whisperEnabled) {
        return NextResponse.json({ error: 'Whisper STT is disabled' }, { status: 503 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        return NextResponse.json({ error: 'Groq API not configured' }, { status: 503 });
    }

    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
        }

        // Min 1KB — anything smaller is noise/artifact, not speech
        if (audioFile.size < 1000) {
            return NextResponse.json({ error: 'Audio too short' }, { status: 400 });
        }

        // Max 10MB audio
        if (audioFile.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Audio too large (max 10MB)' }, { status: 413 });
        }

        // Try turbo model first, fall back to large-v3
        const models = ['whisper-large-v3-turbo', 'whisper-large-v3'];

        for (const model of models) {
            try {
                // Wrap Groq API call in retry logic
                const { response, data } = await retryWithBackoff(
                    async () => {
                        const groqForm = new FormData();
                        groqForm.append('file', audioFile);
                        groqForm.append('model', model);
                        groqForm.append('language', 'en');
                        groqForm.append('response_format', 'verbose_json');
                        groqForm.append('temperature', '0');
                        // DSA vocabulary prompt for better accuracy
                        groqForm.append('prompt',
                            'Technical interview about data structures and algorithms. ' +
                            'DSA vocabulary: Big O notation, O(n log n), binary search, ' +
                            'Dijkstra, BFS, DFS, dynamic programming, memoization, recursion, ' +
                            'hash map, linked list, binary tree, heap, graph, two pointers.');

                        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${groqApiKey}` },
                            body: groqForm,
                        });

                        if (!response.ok) {
                            const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
                            const errMsg = errorBody.error?.message || 'Groq API error';
                            console.error(`[Transcribe] Groq ${model} returned ${response.status}: ${errMsg}`);

                            // For 429 rate limit, throw response so retry logic can handle it
                            if (response.status === 429) {
                                throw response;
                            }
                            throw new Error(errMsg);
                        }

                        const data = await response.json();
                        return { response, data };
                    },
                    {
                        maxRetries: 3,
                        baseDelayMs: 1000,
                        maxDelayMs: 8000,
                        retryOn: (err) => {
                            // Retry on rate limit (429) only
                            return err instanceof Response && err.status === 429;
                        },
                        onRetry: (attempt, err) => {
                            if (err instanceof Response) {
                                console.warn(`[Transcribe] Rate limited (429) on ${model}, retry ${attempt}/3`);
                            }
                        },
                    }
                );

                const segments = data.segments ?? [];
                const confidence = segments.length > 0
                    ? Math.exp(segments.reduce((sum: number, s: { avg_logprob?: number }) => sum + (s.avg_logprob ?? -1), 0) / segments.length)
                    : undefined;

                // Log rate limit info for monitoring
                const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
                const rateLimitReset = response.headers.get('x-ratelimit-reset');
                if (rateLimitRemaining && parseInt(rateLimitRemaining) < 10) {
                    console.warn(`[Transcribe] Groq rate limit low: ${rateLimitRemaining} requests remaining, resets at ${rateLimitReset}`);
                }

                // Confidence gate: reject low-confidence hallucinations (0.15 for short utterances)
                if (confidence !== undefined && confidence < 0.15) {
                    console.warn(`[Transcribe] Low confidence (${confidence.toFixed(3)}), discarding: "${data.text?.substring(0, 60)}"`);
                    return NextResponse.json({ text: '', model, confidence, duration: data.duration });
                }

                return NextResponse.json({
                    text: data.text?.trim() || '',
                    model,
                    confidence,
                    duration: data.duration,
                });
            } catch (err) {
                if (model === models[models.length - 1]) throw err;
                console.warn(`[Transcribe] ${model} failed after retries, trying fallback:`, err);
            }
        }

        return NextResponse.json({ error: 'All transcription models failed' }, { status: 503 });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Transcribe API] Error:', errMsg);
        return NextResponse.json(
            { error: 'Transcription failed', detail: errMsg },
            { status: 500 }
        );
    }
}
