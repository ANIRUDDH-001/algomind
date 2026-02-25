// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getGlobalFeatureFlag
const mockGetGlobalFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags-server', () => ({
    getGlobalFeatureFlag: (...args: unknown[]) => mockGetGlobalFeatureFlag(...args),
}));

// Dynamic imports to get fresh modules after mocking
const { synthesizeWithPolly } = await import('../polly');
const { transcribeBatch } = await import('../transcribe');
const { uploadTranscript } = await import('../s3');
const { isAWSEnabled } = await import('../index');

describe('AWS Service Stubs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('synthesizeWithPolly throws AWS_POLLY_DISABLED when flag is false', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(false);
        await expect(synthesizeWithPolly('hello')).rejects.toThrow('AWS_POLLY_DISABLED');
    });

    it('synthesizeWithPolly throws AWS_POLLY_NOT_INTEGRATED when flag is true', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(true);
        await expect(synthesizeWithPolly('hello')).rejects.toThrow('AWS_POLLY_NOT_INTEGRATED');
    });

    it('transcribeBatch throws AWS_TRANSCRIBE_DISABLED when flag is false', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(false);
        await expect(transcribeBatch('audio/test.wav')).rejects.toThrow('AWS_TRANSCRIBE_DISABLED');
    });

    it('uploadTranscript throws AWS_S3_DISABLED when flag is false', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(false);
        await expect(uploadTranscript('session-123', { transcript: 'test' })).rejects.toThrow('AWS_S3_DISABLED');
    });

    it('isAWSEnabled returns false when all AWS flags are false', async () => {
        mockGetGlobalFeatureFlag.mockResolvedValue(false);
        expect(await isAWSEnabled()).toBe(false);
    });

    it('isAWSEnabled returns true when any single AWS flag is true', async () => {
        // Return true for ENABLE_AWS_POLLY_TTS, false for the rest
        mockGetGlobalFeatureFlag.mockImplementation((key: string) => {
            return Promise.resolve(key === 'ENABLE_AWS_POLLY_TTS');
        });
        expect(await isAWSEnabled()).toBe(true);
    });
});
