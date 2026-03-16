import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { synthesizeWithPolly } from '@/lib/aws/polly';
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';
import { logAWSUsage, estimatePollyCost } from '@/lib/aws/usage-logger';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export const dynamic = 'force-dynamic';

// Polly has a 3000 char limit per request
const MAX_TEXT_LENGTH = 2900;

/**
 * POST /api/voice/synthesize-polly
 * Primary TTS endpoint when AWS Polly is enabled (Kajal Neural voice, Indian English).
 * Client falls back to Groq/browser when Polly is disabled or unavailable.
 */
export async function POST(request: NextRequest) {
    // Auth check — allow guests when ENABLE_GUEST_POLLY_TTS is on
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        const guestPolly = await getGlobalFeatureFlag('ENABLE_GUEST_POLLY_TTS');
        if (!guestPolly) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { text, voice } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Missing text' }, { status: 400 });
        }

        // Preprocess: strip markdown and clean for TTS
        const cleaned = preprocessForTTS(text.replace(/[*_#`]/g, ''));
        const truncated = cleaned.length > MAX_TEXT_LENGTH
            ? cleaned.slice(0, MAX_TEXT_LENGTH)
            : cleaned;

        if (!truncated.trim()) {
            return NextResponse.json({ error: 'Empty text after preprocessing' }, { status: 400 });
        }

        const audioBuffer = await synthesizeWithPolly(truncated, voice || 'Kajal');

        // Log usage for budget tracking (fire-and-forget)
        logAWSUsage({
            service: 'polly',
            operation: 'SynthesizeSpeech',
            region: process.env.AWS_REGION || 'ap-south-1',
            bytesProcessed: audioBuffer.byteLength,
            estimatedCostUsd: estimatePollyCost(truncated.length, (voice || 'Kajal') === 'Kajal'),
            userId: user?.id ?? 'guest',
            metadata: { voice: voice || 'Kajal', textLength: truncated.length },
        }).catch(() => { }); // never block on logging

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

        console.error('[Polly API] Unexpected error:', {
            error: err instanceof Error ? err.message : String(err),
            errorType: err instanceof Error ? err.constructor.name : typeof err,
            voice: 'unknown',
            region: process.env.AWS_REGION || 'ap-south-1',
            hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        });
        return NextResponse.json({ error: 'Internal error', fallback: 'browser' }, { status: 500 });
    }
}
