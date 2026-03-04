import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
import {
    startTranscriptionJob,
    getTranscriptionJobStatus,
    type TranscriptionJobInput,
} from '@/lib/aws/transcribe';
import { logAWSUsage, estimateTranscribeCostFromDuration } from '@/lib/aws/usage-logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/voice/transcribe-batch — Start an AWS Transcribe batch job
 * Body: { mediaUri, jobName, durationSec?, language? }
 * Admin/Owner only — this costs money.
 */
export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Only owners can start Transcribe jobs (costs money)
    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden — owner only' }, { status: 403 });

    try {
        const { mediaUri, jobName, durationSec, language, mediaFormat } = await request.json();

        if (!mediaUri || !jobName) {
            return NextResponse.json({ error: 'Missing mediaUri or jobName' }, { status: 400 });
        }

        const input: TranscriptionJobInput = {
            mediaUri,
            jobName: jobName.replace(/[^a-zA-Z0-9-_.]/g, '-').slice(0, 200),
            language: language || 'en-IN',
            mediaFormat: mediaFormat || 'webm',
            showSpeakerLabels: true,
            maxSpeakers: 2,
        };

        const result = await startTranscriptionJob(input);

        // Log usage
        await logAWSUsage({
            service: 'transcribe',
            operation: 'StartTranscriptionJob',
            region: process.env.AWS_REGION || 'ap-south-1',
            bytesProcessed: 0,
            estimatedCostUsd: estimateTranscribeCostFromDuration(durationSec || 0),
            userId: user.id,
            metadata: { jobName: result.jobName },
        });

        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'AWS_TRANSCRIBE_DISABLED') {
            return NextResponse.json({ error: 'Transcribe disabled via feature flag' }, { status: 503 });
        }
        if (message === 'AWS_TRANSCRIBE_NOT_CONFIGURED') {
            return NextResponse.json({ error: 'AWS Transcribe not configured' }, { status: 503 });
        }

        console.error('[Transcribe API] Error:', message);
        return NextResponse.json({ error: 'Transcribe job failed' }, { status: 500 });
    }
}

/**
 * GET /api/voice/transcribe-batch?jobName=xxx — Check job status
 */
export async function GET(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobName = request.nextUrl.searchParams.get('jobName');
    if (!jobName) {
        return NextResponse.json({ error: 'Missing jobName' }, { status: 400 });
    }

    try {
        const result = await getTranscriptionJobStatus(jobName);
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Transcribe API] Status check error:', message);
        return NextResponse.json({ error: 'Failed to check job status' }, { status: 500 });
    }
}
