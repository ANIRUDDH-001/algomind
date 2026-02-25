/**
 * AWS Service Index
 *
 * Kill switch: set ENABLE_AWS_POLLY_TTS + ENABLE_AWS_TRANSCRIBE_STT +
 * ENABLE_AWS_S3_STORAGE all to false in /admin/features to disable all AWS.
 *
 * All stubs currently throw when called. Phase 7 will replace them with
 * actual AWS SDK integrations.
 */

export { synthesizeWithPolly, type PollyVoice, type PollyError } from './polly';
export { transcribeBatch, type TranscribeError } from './transcribe';
export { uploadTranscript, getTranscript, type S3Error } from './s3';

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

/** Returns true if ANY AWS service flag is enabled. */
export async function isAWSEnabled(): Promise<boolean> {
    const [polly, transcribe, s3] = await Promise.all([
        getGlobalFeatureFlag('ENABLE_AWS_POLLY_TTS'),
        getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT'),
        getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE'),
    ]);
    return polly || transcribe || s3;
}
