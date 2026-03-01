/**
 * AWS Service Index
 *
 * Kill switch: set ENABLE_AWS_POLLY_TTS + ENABLE_AWS_TRANSCRIBE_STT +
 * ENABLE_AWS_S3_STORAGE all to false in /admin/features to disable all AWS.
 */

export { synthesizeWithPolly, resetPollyClient, type PollyVoice, type PollyError } from './polly';
export { startTranscriptionJob, waitForTranscriptionResult, resetTranscribeClient, type TranscribeError } from './transcribe';
export { uploadTranscript, getTranscript, getAudioUploadUrl, getAudioDownloadUrl, deleteObject, resetS3Client, type S3Error } from './s3';

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { env } from '@/lib/startup/validateEnv';

/** Returns true if ANY AWS service flag is enabled. */
export async function isAWSEnabled(): Promise<boolean> {
    const [polly, transcribe, s3] = await Promise.all([
        getGlobalFeatureFlag('ENABLE_AWS_POLLY_TTS'),
        getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT'),
        getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE'),
    ]);
    return polly || transcribe || s3;
}

/**
 * Returns true if AWS credentials are configured.
 * Call this before any AWS SDK operation.
 */
export function isAwsConfigured(): boolean {
    return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_REGION);
}

/**
 * Throws a descriptive error if AWS is not configured.
 * Use in Polly, S3, and Transcribe route handlers.
 */
export function requireAwsConfig(featureName: string): void {
    if (!isAwsConfigured()) {
        throw new Error(
            `[AWS] ${featureName} requires AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION. ` +
            'Set these in your .env.local or Vercel environment variables.'
        );
    }
}
