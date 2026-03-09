import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export const dynamic = 'force-dynamic';

// Phase 3e: Simple in-memory rate limiter for guest IP tracking
const guestRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkGuestRateLimit(key: string, maxRequests: number, windowSeconds: number): boolean {
    const now = Date.now();
    const entry = guestRateLimits.get(key);

    if (!entry || now > entry.resetAt) {
        guestRateLimits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return false;
    }

    entry.count++;
    if (entry.count > maxRequests) {
        return true; // Rate limited
    }
    return false;
}

// Periodically clean up stale entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of guestRateLimits.entries()) {
            if (now > entry.resetAt) guestRateLimits.delete(key);
        }
    }, 5 * 60 * 1000);
}

export async function POST(req: NextRequest) {
    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        // Phase 3e: Allow guest usage but enforce rate limiting by IP
        const ip = req.headers.get('x-forwarded-for') ||
            req.headers.get('x-real-ip') || 'unknown';
        const rateLimitKey = `whisper_guest_${ip}`;
        const isRateLimited = checkGuestRateLimit(rateLimitKey, 20, 60);
        if (isRateLimited) {
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
        const hinglishEnabled = await getGlobalFeatureFlag('ENABLE_HINGLISH_SUPPORT');

        const vocabPrompt = hinglishEnabled
            ? 'Technical interview about data structures and algorithms. Candidate may speak in Hinglish (Hindi-English mix). ' +
            'DSA vocabulary: Big O notation, binary search, Dijkstra, BFS, DFS, dynamic programming, ' +
            'hash map, linked list, binary tree. Hindi filler words: matlab, yaar, toh, karo, samjhe.'
            : 'Technical interview about data structures and algorithms. ' +
            'DSA vocabulary: Big O notation, O(n log n), binary search, ' +
            'Dijkstra, BFS, DFS, dynamic programming, memoization, recursion, ' +
            'hash map, linked list, binary tree, heap, graph, two pointers.';

        for (const model of models) {
            try {
                const groqForm = new FormData();
                groqForm.append('file', audioFile);
                groqForm.append('model', model);
                if (!hinglishEnabled) {
                    groqForm.append('language', 'en');
                }
                groqForm.append('response_format', 'verbose_json');
                // DSA vocabulary prompt — Hinglish-aware when flag is on
                groqForm.append('prompt', vocabPrompt);

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

                return NextResponse.json({
                    text: data.text?.trim() || '',
                    model,
                    confidence: data.segments?.[0]?.avg_logprob
                        ? Math.exp(data.segments[0].avg_logprob)
                        : undefined,
                    duration: data.duration,
                });
            } catch (err) {
                if (model === models[models.length - 1]) throw err;
                console.warn(`[Transcribe] ${model} failed, trying fallback:`, err);
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
