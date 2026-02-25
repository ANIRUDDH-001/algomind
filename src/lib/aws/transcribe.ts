/**
 * AWS Transcribe Batch STT Stub
 *
 * This is BATCH only, not real-time. Used for post-interview analysis enrichment.
 * After an interview ends, the audio is uploaded to S3, then a Transcribe job
 * processes it asynchronously to produce a high-quality transcript.
 *
 * TODO Phase 7 AWS Integration:
 * import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe"
 * const client = new TranscribeClient({ region: process.env.AWS_REGION })
 * const command = new StartTranscriptionJobCommand({
 *   TranscriptionJobName: `algomind-${Date.now()}`,
 *   LanguageCode: "en-IN",  // Indian English
 *   Media: { MediaFileUri: `s3://${process.env.AWS_S3_BUCKET}/${audioS3Key}` },
 *   OutputBucketName: process.env.AWS_S3_BUCKET,
 *   OutputKey: `transcripts/${audioS3Key}.json`,
 *   Settings: {
 *     ShowSpeakerLabels: true,
 *     MaxSpeakerLabels: 2  // interviewer + candidate
 *   }
 * })
 * await client.send(command)
 * // Poll for completion or use EventBridge notification
 */

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type TranscribeError = 'AWS_TRANSCRIBE_DISABLED' | 'AWS_TRANSCRIBE_NOT_INTEGRATED' | 'AWS_TRANSCRIBE_FAILED';

export async function transcribeBatch(audioS3Key: string): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT');

    if (!enabled) {
        throw new Error('AWS_TRANSCRIBE_DISABLED' satisfies TranscribeError);
    }

    // TODO Phase 7: Replace this with actual AWS SDK call (see top of file)
    throw new Error('AWS_TRANSCRIBE_NOT_INTEGRATED' satisfies TranscribeError);
}
