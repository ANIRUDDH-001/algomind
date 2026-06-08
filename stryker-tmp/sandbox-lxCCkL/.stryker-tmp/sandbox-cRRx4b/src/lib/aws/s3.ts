/**
 * @codesage
 * @description AWS S3 client implementation for storing interview transcripts.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

/**
 * AWS S3 Client — Transcript Storage
 *
 * Stores interview transcripts as JSON on S3 when ENABLE_AWS_S3_STORAGE flag is ON.
 * Falls back to Supabase JSONB storage when OFF.
 * Region configurable via AWS_REGION env var (default: ap-south-1).
 */

import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type S3Error = 'AWS_S3_DISABLED' | 'AWS_S3_NOT_CONFIGURED' | 'AWS_S3_FAILED';

// Lazy singleton
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!s3Client) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS_S3_NOT_CONFIGURED' satisfies S3Error);
        }
        if (!process.env.AWS_S3_BUCKET) {
            throw new Error('AWS_S3_NOT_CONFIGURED' satisfies S3Error);
        }
        s3Client = new S3Client({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return s3Client;
}

function getBucket(): string {
    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) throw new Error('AWS_S3_NOT_CONFIGURED' satisfies S3Error);
    return bucket;
}

/**
 * Build the S3 key for a session transcript.
 * Format: transcripts/{userId}/{sessionId}.json
 */
function buildTranscriptKey(sessionId: string, userId?: string | null): string {
    const userDir = userId || 'anonymous';
    return `transcripts/${userDir}/${sessionId}.json`;
}

/**
 * Upload a session transcript to S3.
 * Returns the S3 key if successful.
 */
export async function uploadTranscript(
    sessionId: string,
    transcript: unknown[],
    userId?: string | null,
    metadata?: Record<string, string>
): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    const key = buildTranscriptKey(sessionId, userId);

    const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: JSON.stringify(transcript),
        ContentType: 'application/json',
        Metadata: {
            sessionId,
            userId: userId || 'anonymous',
            uploadedAt: new Date().toISOString(),
            ...metadata,
        },
    });

    try {
        await getS3Client().send(command);
        return key;
    } catch (err) {
        console.error('[S3] Upload failed:', {
            error: err instanceof Error ? err.message : String(err),
            key,
            bucket: getBucket(),
            region: process.env.AWS_REGION || 'ap-south-1',
        });
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/**
 * Download a session transcript from S3. Returns parsed JSON array.
 */
export async function downloadTranscript(s3Key: string): Promise<unknown[]> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: s3Key,
    });

    try {
        const response = await getS3Client().send(command);
        if (!response.Body) throw new Error('AWS_S3_FAILED' satisfies S3Error);
        const text = await response.Body.transformToString('utf-8');
        return JSON.parse(text);
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('AWS_S3')) throw err;
        console.error('[S3] Download failed:', {
            error: err instanceof Error ? err.message : String(err),
            key: s3Key,
        });
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/**
 * Delete a session transcript from S3.
 */
export async function deleteTranscript(s3Key: string): Promise<void> {
    const command = new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: s3Key,
    });

    try {
        await getS3Client().send(command);
    } catch (err) {
        console.error('[S3] Delete failed:', {
            error: err instanceof Error ? err.message : String(err),
            key: s3Key,
        });
        // Don't throw on delete failure — not critical
    }
}


