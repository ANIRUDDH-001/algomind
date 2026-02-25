import { NextRequest, NextResponse } from 'next/server';
import { synthesizeWithPolly } from '@/lib/aws/polly';

/**
 * POST /api/voice/synthesize-polly
 * TTS endpoint using AWS Polly (Kajal Neural voice).
 * Falls back to browser TTS when disabled or not yet integrated.
 */
export async function POST(request: NextRequest) {
    try {
        const { text, voice } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid "text" field' },
                { status: 400 }
            );
        }

        const audioBuffer = await synthesizeWithPolly(text, voice);

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'X-TTS-Provider': 'aws-polly',
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'AWS_POLLY_DISABLED') {
            return NextResponse.json(
                { error: 'AWS Polly TTS is disabled', fallback: 'browser', provider: 'aws' },
                { status: 503 }
            );
        }

        if (message === 'AWS_POLLY_NOT_INTEGRATED') {
            return NextResponse.json(
                { error: 'Coming soon', fallback: 'browser', provider: 'aws' },
                { status: 503 }
            );
        }

        // Unexpected error
        return NextResponse.json(
            { error: 'AWS Polly failed', fallback: 'browser', provider: 'aws' },
            { status: 502 }
        );
    }
}
