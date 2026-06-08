// @ts-nocheck
// 
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { ApiErrors, apiError, ErrorCodes } from '@/lib/api/error-response';

export const maxDuration = 30;

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
            return ApiErrors.rateLimited('Rate limited');
        }
    }

    // Check if Whisper is enabled globally
    const whisperEnabled = await getGlobalFeatureFlag('ENABLE_WHISPER_STT');
    if (!whisperEnabled) {
        return apiError(503, ErrorCodes.FEATURE_DISABLED, 'Whisper STT not enabled', { degraded_mode: 'browser_stt' });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        return ApiErrors.serverError('Server misconfiguration', 'GROQ_API_KEY missing');
    }

    try {
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;

        if (!audioFile) {
            return ApiErrors.badRequest('No audio file provided');
        }

        // Min 1KB — anything smaller is noise/artifact, not speech
        if (audioFile.size < 1000) {
            return ApiErrors.badRequest('Audio too short');
        }

        // Max 10MB audio
        if (audioFile.size > 10 * 1024 * 1024) {
            return ApiErrors.badRequest('Audio too large (max 10MB)');
        }

        // Try turbo model first, fall back to large-v3
        const models = ['whisper-large-v3-turbo', 'whisper-large-v3'];

        for (const model of models) {
            try {
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
                    if (response.status === 429) continue; // Rate limited, try next model
                    throw new Error(errMsg);
                }

                const data = await response.json();

                const segments = data.segments ?? [];
                const confidence = segments.length > 0
                    ? Math.exp(segments.reduce((sum: number, s: { avg_logprob?: number }) => sum + (s.avg_logprob ?? -1), 0) / segments.length)
                    : undefined;

                // Confidence gate: reject low-confidence hallucinations (0.15 for short utterances)
                const MIN_CONFIDENCE_THRESHOLD = 0.3;  // Accommodates accents
                const MIN_TRANSCRIPT_WORDS = 2;

                const confidenceOk = confidence === undefined || confidence >= MIN_CONFIDENCE_THRESHOLD;
                const hasSubstantiveText = (data.text?.trim().split(/\s+/).length ?? 0) >= MIN_TRANSCRIPT_WORDS;

                // Drop only if BOTH confidence low AND text too short (likely noise)
                if (!confidenceOk && !hasSubstantiveText) {
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
                console.warn(`[Transcribe] ${model} failed, trying fallback:`, err);
            }
        }

        return apiError(502, ErrorCodes.PROVIDER_ERROR, 'All STT models failed', { retryable: true, degraded_mode: 'browser_stt' });

    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Transcribe API] Error:', errMsg);
        return apiError(500, ErrorCodes.PROVIDER_ERROR, 'Transcription failed', {
            retryable: true,
            details: errMsg,
            degraded_mode: 'text_only',
        });
    }
}
