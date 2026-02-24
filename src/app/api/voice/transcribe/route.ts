import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        // Max 10MB audio
        if (audioFile.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Audio too large (max 10MB)' }, { status: 413 });
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
                    const error = await response.json();
                    if (response.status === 429) continue; // Rate limited, try next model
                    throw new Error(error.error?.message || 'Groq API error');
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
        console.error('[Transcribe API] Error:', error);
        return NextResponse.json(
            { error: 'Transcription failed' },
            { status: 500 }
        );
    }
}
