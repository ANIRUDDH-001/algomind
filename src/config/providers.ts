/**
 * Provider Configuration — Single source of truth for service routing.
 *
 * SERVER-SIDE ONLY — import only in API routes and Server Actions.
 *
 * AWS Kill-Switch Pattern:
 *   To disable all AWS: set ENABLE_AWS_POLLY_TTS=false, ENABLE_AWS_TRANSCRIBE_STT=false,
 *   ENABLE_AWS_S3_STORAGE=false in admin panel. Zero code changes required.
 */

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import type { FeatureFlagKey } from '@/lib/feature-flags';

// ─── Provider Types ────────────────────────────────────────────────────────

export type TTSProvider = 'groq' | 'browser' | 'aws-polly';
export type STTProvider = 'groq-whisper' | 'browser' | 'aws-transcribe';
export type StorageProvider = 'supabase' | 'aws-s3';

export interface ProviderConfig {
    tts: TTSProvider;
    stt: STTProvider;
    storage: StorageProvider;
    /** true if ANY aws flag is on */
    awsEnabled: boolean;
}

// ─── Async version (reads flags from Redis → Supabase) ─────────────────────

/**
 * Resolve the active provider configuration by reading feature flags.
 *
 * Priority:
 *  - TTS:     groq → aws-polly → browser
 *  - STT:     groq-whisper → browser  (aws-transcribe is batch-only, NOT real-time)
 *  - Storage: aws-s3 → supabase
 */
export async function getProviderConfig(): Promise<ProviderConfig> {
    const [
        groqTts,
        awsPollyTts,
        whisperStt,
        awsTranscribeStt,
        awsS3Storage,
    ] = await Promise.all([
        getGlobalFeatureFlag('ENABLE_GROQ_TTS' as FeatureFlagKey),
        getGlobalFeatureFlag('ENABLE_AWS_POLLY_TTS' as FeatureFlagKey),
        getGlobalFeatureFlag('ENABLE_WHISPER_STT' as FeatureFlagKey),
        getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT' as FeatureFlagKey),
        getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE' as FeatureFlagKey),
    ]);

    return resolveConfig({
        ENABLE_GROQ_TTS: groqTts,
        ENABLE_AWS_POLLY_TTS: awsPollyTts,
        ENABLE_WHISPER_STT: whisperStt,
        ENABLE_AWS_TRANSCRIBE_STT: awsTranscribeStt,
        ENABLE_AWS_S3_STORAGE: awsS3Storage,
    });
}

// ─── Sync version (for edge cases with pre-fetched flags) ──────────────────

/**
 * Resolve provider config from a pre-fetched flags object.
 * No DB call — useful in middleware, edge functions, or when flags are
 * already available from a bulk fetch.
 */
export function getProviderConfigSync(flags: Record<string, boolean>): ProviderConfig {
    return resolveConfig(flags);
}

// ─── Shared resolution logic ───────────────────────────────────────────────

function resolveConfig(flags: Record<string, boolean>): ProviderConfig {
    // TTS priority: groq → aws-polly → browser
    let tts: TTSProvider = 'browser';
    if (flags.ENABLE_GROQ_TTS) {
        tts = 'groq';
    } else if (flags.ENABLE_AWS_POLLY_TTS) {
        tts = 'aws-polly';
    }

    // STT (real-time): groq-whisper → browser
    // Note: aws-transcribe is for batch post-processing only, NOT real-time
    let stt: STTProvider = 'browser';
    if (flags.ENABLE_WHISPER_STT) {
        stt = 'groq-whisper';
    }

    // Storage: aws-s3 → supabase
    let storage: StorageProvider = 'supabase';
    if (flags.ENABLE_AWS_S3_STORAGE) {
        storage = 'aws-s3';
    }

    // awsEnabled: true if ANY aws service is active
    const awsEnabled = !!(
        flags.ENABLE_AWS_POLLY_TTS ||
        flags.ENABLE_AWS_TRANSCRIBE_STT ||
        flags.ENABLE_AWS_S3_STORAGE
    );

    return { tts, stt, storage, awsEnabled };
}
