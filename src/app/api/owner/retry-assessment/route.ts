import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwnerForApi } from '@/lib/auth/requireOwnerForApi';
import { logSystemEvent } from '@/lib/monitoring/events';

export async function POST(req: NextRequest) {
    const authResult = await requireOwnerForApi();
    if (authResult.errorResponse) return authResult.errorResponse;

    let submissionId: string;
    try {
        const body = await req.json();
        submissionId = body.submissionId;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!submissionId) {
        return NextResponse.json({ error: 'Missing submissionId' }, { status: 400 });
    }

    const supabaseAdmin = getServiceClient();

    void logSystemEvent({
        type: 'admin_action',
        userId: authResult.user.id,
        metadata: {
            route: 'owner/retry-assessment',
            action: 'retry_assessment',
            submissionId,
        },
    });

    // Fetch question states for re-analysis
    const { data: submission } = await supabaseAdmin
        .from('candidate_submissions')
        .select('question_states, integrity_flags')
        .eq('id', submissionId)
        .single();

    if (!submission) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Reset status to pending
    await supabaseAdmin
        .from('candidate_submissions')
        .update({ analysis_status: 'pending', analysis_error: null })
        .eq('id', submissionId);

    // Re-invoke the edge function
    const edgeFunctionSecret = process.env.INTERNAL_API_SECRET;
    if (!edgeFunctionSecret) {
        return NextResponse.json({ error: 'INTERNAL_API_SECRET not configured' }, { status: 500 });
    }

    supabaseAdmin.functions.invoke('run-assessment', {
        body: {
            submissionId,
            questionStates: submission.question_states,
            integrityFlags: submission.integrity_flags ?? [],
        },
        headers: { Authorization: `Bearer ${edgeFunctionSecret}` },
    }).catch(err => console.error('[Retry] Edge function invoke failed:', err));

    return NextResponse.json({ success: true });
}
