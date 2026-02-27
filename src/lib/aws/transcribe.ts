/**
 * AWS Transcribe Batch STT — Real Implementation
 *
 * Post-interview analysis: audio uploaded to S3 → Transcribe job processes
 * asynchronously → high-quality transcript for assessment enrichment.
 *
 * Language: en-IN (Indian English) for best accuracy with Indian speakers.
 * Region: ap-south-1 (Mumbai).
 */

import {
    TranscribeClient,
    StartTranscriptionJobCommand,
    GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';

export type TranscribeError = 'AWS_TRANSCRIBE_DISABLED' | 'AWS_TRANSCRIBE_NOT_CONFIGURED' | 'AWS_TRANSCRIBE_FAILED';

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

/**
 * Start a batch transcription job for a session audio file on S3.
 * Returns a job name — poll with waitForTranscriptionResult().
 */
export async function startTranscriptionJob(audioS3Key: string, sessionId: string): Promise<string> {
    const enabled = await getGlobalFeatureFlag('ENABLE_AWS_TRANSCRIBE_STT');
    if (!enabled) throw new Error('AWS_TRANSCRIBE_DISABLED' satisfies TranscribeError);

    const jobName = `algomind-${sessionId}-${Date.now()}`;
    const bucket = process.env.AWS_S3_BUCKET!;

    if (!bucket) throw new Error('AWS_TRANSCRIBE_NOT_CONFIGURED' satisfies TranscribeError);

    const command = new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: 'en-IN',
        Media: { MediaFileUri: `s3://${bucket}/${audioS3Key}` },
        OutputBucketName: bucket,
        OutputKey: `transcripts/aws/${sessionId}.json`,
        Settings: {
            ShowSpeakerLabels: true,
            MaxSpeakerLabels: 2, // interviewer + candidate
        },
    });

    try {
        await getTranscribeClient().send(command);
        return jobName;
    } catch (err) {
        console.error('[Transcribe] Start job failed:', err);
        throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);
    }
}

/**
 * Poll a transcription job until completion (or timeout).
 * Max wait: 5 minutes by default. Returns the full transcript text.
 */
export async function waitForTranscriptionResult(
    jobName: string,
    timeoutMs = 5 * 60 * 1000
): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
        try {
            const response = await getTranscribeClient().send(
                new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
            );

            const status = response.TranscriptionJob?.TranscriptionJobStatus;

            if (status === 'COMPLETED') {
                const transcriptUri = response.TranscriptionJob?.Transcript?.TranscriptFileUri;
                if (!transcriptUri) throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);

                const transcriptResponse = await fetch(transcriptUri);
                const data = await transcriptResponse.json();
                return data.results?.transcripts?.[0]?.transcript || '';
            }

            if (status === 'FAILED') {
                console.error('[Transcribe] Job failed:', response.TranscriptionJob?.FailureReason);
                throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);
            }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('AWS_TRANSCRIBE')) throw err;
            console.error('[Transcribe] Poll error:', err);
        }

        await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new Error('AWS_TRANSCRIBE_FAILED' satisfies TranscribeError);
}

export function resetTranscribeClient(): void { transcribeClient = null; }
