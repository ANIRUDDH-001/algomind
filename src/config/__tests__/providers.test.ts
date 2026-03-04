import { describe, it, expect } from 'vitest';
import { getProviderConfigSync } from '../providers';

/** Helper: returns a flags object with all relevant flags set to false. */
function allOff(): Record<string, boolean> {
    return {
        ENABLE_GROQ_TTS: false,
        ENABLE_AWS_POLLY_TTS: false,
        ENABLE_WHISPER_STT: false,
        ENABLE_AWS_TRANSCRIBE_STT: false,
        ENABLE_AWS_S3_STORAGE: false,
        ENABLE_AWS_BEDROCK: false,
    };
}

describe('getProviderConfigSync', () => {
    // ── TTS ─────────────────────────────────────────────────────────────

    it('returns browser TTS when all flags off', () => {
        const config = getProviderConfigSync(allOff());
        expect(config.tts).toBe('browser');
    });

    it('returns groq TTS when ENABLE_GROQ_TTS=true', () => {
        const config = getProviderConfigSync({ ...allOff(), ENABLE_GROQ_TTS: true });
        expect(config.tts).toBe('groq');
    });

    it('returns aws-polly TTS when both groq and polly flags are on (AWS is primary)', () => {
        const config = getProviderConfigSync({
            ...allOff(),
            ENABLE_GROQ_TTS: true,
            ENABLE_AWS_POLLY_TTS: true,
        });
        // AWS Polly is primary when its flag is ON
        expect(config.tts).toBe('aws-polly');
    });

    it('returns aws-polly when only AWS flag is on', () => {
        const config = getProviderConfigSync({ ...allOff(), ENABLE_AWS_POLLY_TTS: true });
        expect(config.tts).toBe('aws-polly');
    });

    // ── STT ─────────────────────────────────────────────────────────────

    it('returns groq-whisper STT when ENABLE_WHISPER_STT=true', () => {
        const config = getProviderConfigSync({ ...allOff(), ENABLE_WHISPER_STT: true });
        expect(config.stt).toBe('groq-whisper');
    });

    it('returns browser STT when whisper off', () => {
        const config = getProviderConfigSync(allOff());
        expect(config.stt).toBe('browser');
    });

    // ── Storage ─────────────────────────────────────────────────────────

    it('returns supabase storage by default', () => {
        const config = getProviderConfigSync(allOff());
        expect(config.storage).toBe('supabase');
    });

    it('returns aws-s3 when ENABLE_AWS_S3_STORAGE=true', () => {
        const config = getProviderConfigSync({ ...allOff(), ENABLE_AWS_S3_STORAGE: true });
        expect(config.storage).toBe('aws-s3');
    });

    // ── awsEnabled ──────────────────────────────────────────────────────

    it('awsEnabled=false when all AWS flags off', () => {
        const config = getProviderConfigSync(allOff());
        expect(config.awsEnabled).toBe(false);
    });

    it('awsEnabled=true when any single AWS flag on', () => {
        // Polly only
        expect(getProviderConfigSync({ ...allOff(), ENABLE_AWS_POLLY_TTS: true }).awsEnabled).toBe(true);
        // Transcribe only
        expect(getProviderConfigSync({ ...allOff(), ENABLE_AWS_TRANSCRIBE_STT: true }).awsEnabled).toBe(true);
        // S3 only
        expect(getProviderConfigSync({ ...allOff(), ENABLE_AWS_S3_STORAGE: true }).awsEnabled).toBe(true);
        // Bedrock only
        expect(getProviderConfigSync({ ...allOff(), ENABLE_AWS_BEDROCK: true }).awsEnabled).toBe(true);
    });
});
