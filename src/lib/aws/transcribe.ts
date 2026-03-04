/**
 * AWS Transcribe — Batch Transcription Enrichment
 *
 * NOT for real-time STT (use Groq Whisper for that).
 * Used for post-interview transcript enrichment:
 *   - Better accuracy for evaluation
 *   - Speaker diarization
 *   - Vocabulary filtering
 *
 * Region configurable via AWS_REGION env var (default: ap-south-1).
 */

import {
    TranscribeClient,
    StartTranscriptionJobCommand,
    GetTranscriptionJobCommand,
    type LanguageCode,
} from '@aws-sdk/client-transcribe';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type TranscribeError =
    | 'AWS_TRANSCRIBE_DISABLED'
    | 'AWS_TRANSCRIBE_NOT_CONFIGURED'
    | 'AWS_TRANSCRIBE_FAILED';

// Lazy singleton
let transcribeClient: TranscribeClient | null = null;

function getTranscribeClient(): TranscribeClient {
    if (!transcribeClient) {
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('AWS_TRANSCRIBE_NOT_CONFIGURED' satisfies TranscribeError);
        }
        transcribeClient = new TranscribeClient({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return transcribeClient;
}

export interface TranscriptionJobInput {
    /** S3 URI of the audio file: s3://bucket/key */
    mediaUri: string;
    /** Unique job name (alphanumeric + hyphens, max 200 chars) */
    jobName: string;
    /** Audio format */
    mediaFormat?: 'mp3' | 'wav' | 'ogg' | 'webm';
    /** Language (default: en-IN for Indian English) */
    language?: LanguageCode;
    /** Enable speaker diarization */
    showSpeakerLabels?: boolean;
    /** Max speakers for diarization */
    maxSpeakers?: number;
}

export interface TranscriptionJobResult {
    jobName: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'QUEUED';
    transcriptUri?: string;
    failureReason?: string;
}

/**
 * Start a batch transcription job.
 * Audio must already be in S3 (use uploadTranscript or a separate audio upload).
 */
export async function startTranscriptionJob(
    input: TranscriptionJobInput
): Promise<TranscriptionJobResult> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT');
    if (!enabled) throw new Error('AWS_TRANSCRIBE_DISABLED' satisfies TranscribeError);

    const bucket = process.env.AWS_S3_BUCKET;
    if (!bucket) {
        throw new Error('AWS_TRANSCRIBE_NOT_CONFIGURED' satisfies TranscribeError);
    }

    const command = new StartTranscriptionJobCommand({
        TranscriptionJobName: input.jobName,
        LanguageCode: input.language || 'en-IN',
        MediaFormat: input.mediaFormat || 'webm',
        Media: {
            MediaFileUri: input.mediaUri,
        },
        OutputBucketName: bucket,
        OutputKey: `transcriptions/${input.jobName}.json`,
        Settings: input.showSpeakerLabels
            ? {
                ShowSpeakerLabels: true,
                MaxSpeakerLabels: input.maxSpeakers || 2,
            }
            : undefined,
    });

    try {
        const response = await getTranscribeClient().send(command);
        const job = response.TranscriptionJob;
        return {
            jobName: job?.TranscriptionJobName || input.jobName,
            status: (job?.TranscriptionJobStatus as TranscriptionJobResult['status']) || 'QUEUED',
        };
    } catch (err) {
        console.error('[Transcribe] Start job failed:', {
            error: err instanceof Error ? err.message : String(err),
            jobName: input.jobName,
            region: process.env.AWS_REGION || 'ap-south-1',
        });
        throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);
    }
}

/**
 * Check the status of a transcription job.
 */
export async function getTranscriptionJobStatus(
    jobName: string
): Promise<TranscriptionJobResult> {
    const command = new GetTranscriptionJobCommand({
        TranscriptionJobName: jobName,
    });

    try {
        const response = await getTranscribeClient().send(command);
        const job = response.TranscriptionJob;
        return {
            jobName: job?.TranscriptionJobName || jobName,
            status: (job?.TranscriptionJobStatus as TranscriptionJobResult['status']) || 'FAILED',
            transcriptUri: job?.Transcript?.TranscriptFileUri,
            failureReason: job?.FailureReason,
        };
    } catch (err) {
        console.error('[Transcribe] Get job status failed:', {
            error: err instanceof Error ? err.message : String(err),
            jobName,
        });
        throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);
    }
}

/**
 * Estimate cost for a Transcribe job.
 * AWS Transcribe: $0.024/min (standard), first 60 min free per month.
 */
export function estimateTranscribeCost(durationSeconds: number): number {
    const minutes = durationSeconds / 60;
    return minutes * 0.024;
}

/** Reset client (useful after credentials change) */
export function resetTranscribeClient(): void {
    transcribeClient = null;
}
