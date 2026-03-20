import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

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

    void request;
    return NextResponse.json({ error: 'AWS Transcribe batch API has been retired' }, { status: 410 });
}

/**
 * GET /api/voice/transcribe-batch?jobName=xxx — Check job status
 */
export async function GET(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    void request;
    return NextResponse.json({ error: 'AWS Transcribe batch API has been retired' }, { status: 410 });
}
