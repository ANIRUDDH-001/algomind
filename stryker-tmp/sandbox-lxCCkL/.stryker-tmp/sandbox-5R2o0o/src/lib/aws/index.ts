/**
 * @codesage
 * @description Central export index and feature flag checks for AWS integrations.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

/**
 * AWS Service Index
 *
 * Kill switch: set ENABLE_AWS_POLLY_TTS + ENABLE_AWS_TRANSCRIBE_STT +
 * ENABLE_AWS_S3_STORAGE all to false in /admin/features to disable all AWS.
 */

export { synthesizeWithPolly, type PollyVoice, type PollyError } from './polly';
export { uploadTranscript, downloadTranscript, deleteTranscript, type S3Error } from './s3';
export { logAWSUsage, estimatePollyCost, estimateBedrockCost, estimateTranscribeCostFromDuration, estimateS3PutCost, type AWSService, type UsageLogEntry } from './usage-logger';

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { env } from '@/lib/startup/validateEnv';

/** Returns true if ANY AWS service flag is enabled. */
export async function isAWSEnabled(): Promise<boolean> {
    const [polly, transcribe, s3, bedrock] = await Promise.all([
        getGlobalFeatureFlag('ENABLE_AWS_POLLY_TTS'),
        getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT'),
        getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE'),
        getGlobalFeatureFlag('ENABLE_AWS_BEDROCK'),
    ]);
    return polly || transcribe || s3 || bedrock;
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
