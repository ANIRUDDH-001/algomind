import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
    try {
        const { sessionId } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // Security check: ensure this session belongs to a candidate submission for a campaign owned by this employer
        const { data: submission, error: subError } = await supabase
            .from('candidate_submissions')
            .select('campaign_id')
            .eq('session_id', sessionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('created_by')
            .eq('id', submission.campaign_id)
            .single();

        if (campaignError || !campaign || campaign.created_by !== auth.user.id) {
            return NextResponse.json({ error: 'Unauthorized to view this session' }, { status: 403 });
        }

        // Fetch the session transcript and problem details
        const { data: sessionData, error: sessionError } = await supabase
            .from('interview_sessions')
            .select('transcript, duration, created_at, completed_at, problem_title, problem_id')
            .eq('id', sessionId)
            .single();

        if (sessionError || !sessionData) {
            return NextResponse.json({ error: 'Failed to fetch transcript details' }, { status: 500 });
        }

        return NextResponse.json({ session: sessionData });

    } catch (error: unknown) {
        console.error('[TRANSCRIPT_GET_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
