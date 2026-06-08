/**
 * @codesage
 * @description AWS Polly TTS client implementation for synthesizing AI speech.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

/**
 * AWS Polly TTS — Real Implementation
 *
 * Uses Kajal (Neural, Indian English) as default voice.
 * Aditi uses standard engine.
 * Region: ap-south-1 (Mumbai) for lowest latency to Indian users.
 */

import { PollyClient, SynthesizeSpeechCommand, type Engine } from '@aws-sdk/client-polly';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type PollyVoice = 'Kajal' | 'Aditi';
export type PollyError = 'AWS_POLLY_DISABLED' | 'AWS_POLLY_NOT_CONFIGURED' | 'AWS_POLLY_FAILED';

// Lazy singleton — don't create until needed
let pollyClient: PollyClient | null = null;

function getPollyClient(): PollyClient {
    if (!pollyClient) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS_POLLY_NOT_CONFIGURED' satisfies PollyError);
        }
        pollyClient = new PollyClient({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return pollyClient;
}

export async function synthesizeWithPolly(
    text: string,
    voice: PollyVoice = 'Kajal'
): Promise<ArrayBuffer> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_POLLY_TTS');
    if (!enabled) throw new Error('AWS_POLLY_DISABLED' satisfies PollyError);

    // Kajal requires neural engine, Aditi uses standard
    const engine: Engine = voice === 'Kajal' ? 'neural' : 'standard';

    const command = new SynthesizeSpeechCommand({
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: voice,
        Engine: engine,
        TextType: 'text',
        SampleRate: '22050',
    });

    try {
        const client = getPollyClient();
        const response = await client.send(command);

        if (!response.AudioStream) {
            throw new Error('AWS_POLLY_FAILED' satisfies PollyError);
        }

        // Convert ReadableStream to ArrayBuffer
        const chunks: Uint8Array[] = [];
        const reader = response.AudioStream.transformToWebStream().getReader();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }

        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer as ArrayBuffer;
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('AWS_POLLY')) throw err;
        console.error('[Polly] Synthesis error:', {
            error: err instanceof Error ? err.message : String(err),
            errorType: err instanceof Error ? err.constructor.name : typeof err,
            voice,
            engine,
            textLength: text.length,
            region: process.env.AWS_REGION || 'ap-south-1',
            hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
        });
        throw new Error('AWS_POLLY_FAILED' satisfies PollyError);
    }
}


