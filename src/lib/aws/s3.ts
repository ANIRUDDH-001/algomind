/**
 * AWS S3 Storage Stub
 *
 * TODO Phase 7 AWS Integration:
 * import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
 * const s3 = new S3Client({ region: process.env.AWS_REGION })
 *
 * Upload:
 * const command = new PutObjectCommand({
 *   Bucket: process.env.AWS_S3_BUCKET,
 *   Key: `transcripts/${sessionId}.json`,
 *   Body: JSON.stringify(data),
 *   ContentType: "application/json"
 * })
 * await s3.send(command)
 * return `s3://${process.env.AWS_S3_BUCKET}/transcripts/${sessionId}.json`
 *
 * Download:
 * const command = new GetObjectCommand({
 *   Bucket: process.env.AWS_S3_BUCKET,
 *   Key: `transcripts/${sessionId}.json`
 * })
 * const response = await s3.send(command)
 * return JSON.parse(await response.Body.transformToString())
 */

import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type S3Error = 'AWS_S3_DISABLED' | 'AWS_S3_NOT_INTEGRATED' | 'AWS_S3_FAILED';

/** Upload a transcript JSON to S3. Returns the S3 URL. */
export async function uploadTranscript(sessionId: string, data: object): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');

    if (!enabled) {
        throw new Error('AWS_S3_DISABLED' satisfies S3Error);
    }

    // TODO Phase 7: Replace with actual S3 PutObjectCommand (see top of file)
    throw new Error('AWS_S3_NOT_INTEGRATED' satisfies S3Error);
}

/** Retrieve a transcript JSON from S3. Returns null if not found. */
export async function getTranscript(sessionId: string): Promise<object | null> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');

    if (!enabled) {
        throw new Error('AWS_S3_DISABLED' satisfies S3Error);
    }

    // TODO Phase 7: Replace with actual S3 GetObjectCommand (see top of file)
    throw new Error('AWS_S3_NOT_INTEGRATED' satisfies S3Error);
}
