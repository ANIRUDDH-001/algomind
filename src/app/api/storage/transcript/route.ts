import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { uploadTranscript, downloadTranscript } from '@/lib/aws/s3';
import { logAWSUsage, estimateS3PutCost } from '@/lib/aws/usage-logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/storage/transcript — Upload transcript to S3
 * Body: { sessionId, transcript, userId? }
 */
export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { sessionId, transcript, userId } = await request.json();

        if (!sessionId || !Array.isArray(transcript)) {
            return NextResponse.json({ error: 'Missing sessionId or transcript array' }, { status: 400 });
        }

        const s3Key = await uploadTranscript(sessionId, transcript, userId || user.id);
        const bytes = JSON.stringify(transcript).length;

        // Log usage for budget tracking
        await logAWSUsage({
            service: 's3',
            operation: 'PutObject',
            region: process.env.AWS_REGION || 'ap-south-1',
            bytesProcessed: bytes,
            estimatedCostUsd: estimateS3PutCost(bytes),
            userId: user.id,
            sessionId,
        });

        return NextResponse.json({
            success: true,
            s3Key,
            provider: 'aws-s3',
            bytes,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'AWS_S3_DISABLED') {
            return NextResponse.json({ error: 'S3 storage disabled', fallback: 'supabase' }, { status: 503 });
        }
        if (message === 'AWS_S3_NOT_CONFIGURED') {
            return NextResponse.json({ error: 'AWS S3 not configured', fallback: 'supabase' }, { status: 503 });
        }

        console.error('[S3 API] Upload error:', message);
        return NextResponse.json({ error: 'S3 upload failed', fallback: 'supabase' }, { status: 500 });
    }
}

/**
 * GET /api/storage/transcript?key=transcripts/userId/sessionId.json
 * Download transcript from S3.
 */
export async function GET(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const key = request.nextUrl.searchParams.get('key');
    if (!key) {
        return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    try {
        const transcript = await downloadTranscript(key);
        return NextResponse.json({ transcript, provider: 'aws-s3' });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message === 'AWS_S3_DISABLED') {
            return NextResponse.json({ error: 'S3 disabled' }, { status: 503 });
        }

        console.error('[S3 API] Download error:', message);
        return NextResponse.json({ error: 'S3 download failed' }, { status: 500 });
    }
}
