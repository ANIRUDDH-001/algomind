import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';
import type { FeatureFlagKey } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voice/synthesize
 *
 * Groq PlayAI TTS endpoint.
 * - Gate: ENABLE_GROQ_TTS flag must be on
 * - Input: { text: string, voice?: "Aaliya-PlayAI" | "Arjun-PlayAI" }
 * - Output: audio/mpeg binary stream
 * - Fallback: client falls back to browser Web Speech API when this returns non-200
 */
export async function POST(req: NextRequest) {
    // 1. Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Feature flag gate
    const groqTtsEnabled = await getGlobalFeatureFlag('ENABLE_GROQ_TTS' as FeatureFlagKey);
    if (!groqTtsEnabled) {
        return NextResponse.json(
            { error: 'Groq TTS is disabled', fallback: 'browser' },
            { status: 503 }
        );
    }

    // 3. API key check
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
        return NextResponse.json(
            { error: 'Groq API not configured', fallback: 'browser' },
            { status: 503 }
        );
    }

    // 4. Parse body
    let text: string;
    let voice: string;
    try {
        const body = await req.json();
        text = body.text;
        voice = body.voice || 'Aaliya-PlayAI'; // Default: Indian English female

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing "text" field' }, { status: 400 });
        }

        // Limit text length to avoid excessive API usage (≈4000 chars ≈ 2.5 min audio)
        if (text.length > 4000) {
            text = text.slice(0, 4000);
        }
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // 5. Preprocess for DSA pronunciation (reusing existing preprocessor)
    const processedText = preprocessForTTS(text);

    try {
        // 6. Call Groq PlayAI TTS
        const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'playai-tts',
                voice,
                input: processedText,
                response_format: 'mp3',
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Synthesize API] Groq error:', response.status, errorText);
            return NextResponse.json(
                { error: 'TTS synthesis failed', fallback: 'browser' },
                { status: 502 }
            );
        }

        // 7. Stream audio back to client
        const audioBuffer = await response.arrayBuffer();

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': String(audioBuffer.byteLength),
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[Synthesize API] Error:', error);
        return NextResponse.json(
            { error: 'TTS synthesis failed', fallback: 'browser' },
            { status: 500 }
        );
    }
}
