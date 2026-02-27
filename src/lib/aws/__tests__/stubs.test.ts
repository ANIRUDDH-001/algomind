// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getGlobalFeatureFlag
const mockGetGlobalFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags-server', () => ({
    getGlobalFeatureFlag: (...args: unknown[]) => mockGetGlobalFeatureFlag(...args),
}));

// Mock the AWS SDK clients so we don't need real credentials
vi.mock('@aws-sdk/client-polly', () => ({
    PollyClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    SynthesizeSpeechCommand: vi.fn(),
}));
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
    getSignedUrl: vi.fn(),
}));
vi.mock('@aws-sdk/client-transcribe', () => ({
    TranscribeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    StartTranscriptionJobCommand: vi.fn(),
    GetTranscriptionJobCommand: vi.fn(),
}));

// Dynamic imports to get fresh modules after mocking
const { synthesizeWithPolly } = await import('../polly');
const { startTranscriptionJob } = await import('../transcribe');
const { uploadTranscript, getTranscript, getAudioUploadUrl } = await import('../s3');
const { isAWSEnabled } = await import('../index');

describe('AWS Services', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Clear env vars for NOT_CONFIGURED tests
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        delete process.env.AWS_S3_BUCKET;
    });

    describe('Polly', () => {
        it('throws AWS_POLLY_DISABLED when flag is false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            await expect(synthesizeWithPolly('hello')).rejects.toThrow('AWS_POLLY_DISABLED');
        });

        it('throws AWS_POLLY_NOT_CONFIGURED when flag is true but env vars missing', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(true);
            await expect(synthesizeWithPolly('hello')).rejects.toThrow('AWS_POLLY_NOT_CONFIGURED');
        });
    });

    describe('S3', () => {
        it('throws AWS_S3_DISABLED when flag is false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            await expect(uploadTranscript('session-123', { transcript: 'test' })).rejects.toThrow('AWS_S3_DISABLED');
        });

        it('throws AWS_S3_NOT_CONFIGURED when flag is true but env vars missing', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(true);
            await expect(uploadTranscript('session-123', { transcript: 'test' })).rejects.toThrow('AWS_S3_NOT_CONFIGURED');
        });

        it('getTranscript throws AWS_S3_DISABLED when flag is false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            await expect(getTranscript('session-123')).rejects.toThrow('AWS_S3_DISABLED');
        });

        it('getAudioUploadUrl throws AWS_S3_DISABLED when flag is false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            await expect(getAudioUploadUrl('session-123')).rejects.toThrow('AWS_S3_DISABLED');
        });
    });

    describe('Transcribe', () => {
        it('throws AWS_TRANSCRIBE_DISABLED when flag is false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            await expect(startTranscriptionJob('audio/test.wav', 'sess-1')).rejects.toThrow('AWS_TRANSCRIBE_DISABLED');
        });

        it('throws AWS_TRANSCRIBE_NOT_CONFIGURED when flag is true but env vars missing', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(true);
            await expect(startTranscriptionJob('audio/test.wav', 'sess-1')).rejects.toThrow('AWS_TRANSCRIBE_NOT_CONFIGURED');
        });
    });

    describe('isAWSEnabled', () => {
        it('returns false when all AWS flags are false', async () => {
            mockGetGlobalFeatureFlag.mockResolvedValue(false);
            expect(await isAWSEnabled()).toBe(false);
        });

        it('returns true when any single AWS flag is true', async () => {
            mockGetGlobalFeatureFlag.mockImplementation((key: string) => {
                return Promise.resolve(key === 'ENABLE_AWS_POLLY_TTS');
            });
            expect(await isAWSEnabled()).toBe(true);
        });
    });
});
