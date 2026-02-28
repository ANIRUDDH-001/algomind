import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { synthesizeWithPolly } from '@/lib/aws/polly';
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';

export const dynamic = 'force-dynamic';

// Polly has a 3000 char limit per request
const MAX_TEXT_LENGTH = 2900;

/**
 * POST /api/voice/synthesize-polly
 * TTS endpoint using AWS Polly (Kajal Neural voice, Indian English).
 * Falls back to Groq TTS when disabled or unavailable.
 */
export async function POST(request: NextRequest) {
    // Auth check
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { text, voice } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing text' }, { status: 400 });
        }

        // Preprocess: strip markdown and clean for TTS
        const cleaned = preprocessForTTS(text.replace(/[*_#`]/g, ''));
        const truncated = cleaned.length > MAX_TEXT_LENGTH
            ? cleaned.slice(0, MAX_TEXT_LENGTH) + '...'
            : cleaned;

        const audioBuffer = await synthesizeWithPolly(truncated, voice || 'Kajal');

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': audioBuffer.byteLength.toString(),
                'X-TTS-Provider': 'aws-polly',
                'X-Voice': voice || 'Kajal',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'AWS_POLLY_DISABLED') {
            return NextResponse.json({ error: 'Polly disabled', fallback: 'browser' }, { status: 503 });
        }
        if (message === 'AWS_POLLY_NOT_CONFIGURED') {
            return NextResponse.json({ error: 'AWS not configured', fallback: 'browser' }, { status: 503 });
        }
        if (message === 'AWS_POLLY_FAILED') {
            return NextResponse.json({ error: 'Polly synthesis failed', fallback: 'browser' }, { status: 502 });
        }

        console.error('[Polly API] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal error', fallback: 'browser' }, { status: 500 });
    }
}
