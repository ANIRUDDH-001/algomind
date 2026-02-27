/**
 * AWS S3 Storage — Real Implementation
 *
 * Handles transcript JSON storage, audio file presigned URLs.
 * All objects use SSE-S3 (AES256) encryption.
 * Region: ap-south-1 (Mumbai) for lowest latency.
 */

import {
    S3Client, PutObjectCommand, GetObjectCommand,
    DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type S3Error = 'AWS_S3_DISABLED' | 'AWS_S3_NOT_CONFIGURED' | 'AWS_S3_FAILED';

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
    if (!s3Client) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET) {
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

const BUCKET = () => process.env.AWS_S3_BUCKET!;

/** Upload a transcript JSON to S3. Returns the S3 key. */
export async function uploadTranscript(sessionId: string, data: object): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    const key = `transcripts/${sessionId}.json`;
    const command = new PutObjectCommand({
        Bucket: BUCKET(),
        Key: key,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
        ServerSideEncryption: 'AES256',
        Metadata: { 'created-at': new Date().toISOString() },
    });

    try {
        await getS3Client().send(command);
        return key;
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('AWS_S3')) throw err;
        console.error('[S3] Upload failed:', err);
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/** Retrieve a transcript JSON from S3. Returns null if not found. */
export async function getTranscript(sessionId: string): Promise<object | null> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    const key = `transcripts/${sessionId}.json`;
    try {
        const response = await getS3Client().send(
            new GetObjectCommand({ Bucket: BUCKET(), Key: key })
        );
        const text = await response.Body!.transformToString();
        return JSON.parse(text);
    } catch (err: unknown) {
        if (err instanceof Error && err.message.startsWith('AWS_S3')) throw err;
        if ((err as { name?: string }).name === 'NoSuchKey') return null;
        console.error('[S3] Download failed:', err);
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/**
 * Generate a presigned URL for direct audio upload from browser.
 * Audio files stored as: audio/{sessionId}/{timestamp}.webm
 */
export async function getAudioUploadUrl(
    sessionId: string,
    expiresInSeconds = 300
): Promise<{ url: string; key: string }> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    const key = `audio/${sessionId}/${Date.now()}.webm`;
    const command = new PutObjectCommand({
        Bucket: BUCKET(),
        Key: key,
        ContentType: 'audio/webm',
        ServerSideEncryption: 'AES256',
    });

    try {
        const url = await getSignedUrl(getS3Client(), command, { expiresIn: expiresInSeconds });
        return { url, key };
    } catch (err) {
        if (err instanceof Error && err.message.startsWith('AWS_S3')) throw err;
        console.error('[S3] Presigned URL generation failed:', err);
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/** Generate a presigned download URL for audio playback */
export async function getAudioDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_S3_STORAGE');
    if (!enabled) throw new Error('AWS_S3_DISABLED' satisfies S3Error);

    try {
        const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
        return getSignedUrl(getS3Client(), command, { expiresIn: expiresInSeconds });
    } catch (err) {
        console.error('[S3] Download URL generation failed:', err);
        throw new Error('AWS_S3_FAILED' satisfies S3Error);
    }
}

/** Delete an object from S3 */
export async function deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({ Bucket: BUCKET(), Key: key });
    await getS3Client().send(command);
}

export function resetS3Client(): void { s3Client = null; }
