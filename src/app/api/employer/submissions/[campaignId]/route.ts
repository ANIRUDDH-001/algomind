import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
    try {
        const { campaignId } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // 1. Verify employer owns the campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('id')
            .eq('id', campaignId)
            .eq('created_by', auth.user.id)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
        }

        // 2. Fetch all submissions matching the campaign (Step 1 of two-step query)
        const { data: submissions, error: submissionsError } = await supabase
            .from('candidate_submissions')
            .select('id, session_id, candidate_name, candidate_email, status, overall_score, created_at')
            .eq('campaign_id', campaignId)
            .order('overall_score', { ascending: false, nullsFirst: false });

        if (submissionsError) {
            throw submissionsError;
        }

        // 3. Fetch related assessments (Step 2 of two-step query)
        const sessionIds = (submissions || [])
            .map(s => s.session_id)
            .filter(Boolean) as string[];

        let assessments: any[] = [];
        if (sessionIds.length > 0) {
            const { data: assessmentsData, error: assessmentsError } = await supabase
                .from('assessments')
                .select('*')
                .in('session_id', sessionIds);

            if (assessmentsError) throw assessmentsError;
            assessments = assessmentsData || [];
        }

        const assessmentMap = new Map(assessments.map(a => [a.session_id, a]));

        // 4. Compute rank and flatten data structure
        let currentRank = 1;
        const rankedSubmissions = (submissions || []).map((sub) => {
            const hasScore = typeof sub.overall_score === 'number' || !isNaN(Number(sub.overall_score));
            const rank = hasScore && sub.overall_score !== null ? currentRank++ : null;

            const assessment = sub.session_id ? assessmentMap.get(sub.session_id) : null;

            return {
                id: sub.id,
                campaign_id: campaignId,
                candidate_name: sub.candidate_name,
                candidate_email: sub.candidate_email,
                status: sub.status,
                overall_score: sub.overall_score,
                created_at: sub.created_at,
                rank,
                feedback: assessment?.overall_feedback || null,
                // Flatten skill scores directly onto the object
                problem_decomposition: assessment?.problem_decomposition ?? null,
                pattern_recognition: assessment?.pattern_recognition ?? null,
                algorithmic_thinking: assessment?.algorithmic_thinking ?? null,
                complexity_analysis: assessment?.complexity_analysis ?? null,
                communication_clarity: assessment?.communication_clarity ?? null,
                edge_case_awareness: assessment?.edge_case_awareness ?? null,
                optimization_mindset: assessment?.optimization_mindset ?? null,
                debugging_approach: assessment?.debugging_approach ?? null,
            };
        });

        return NextResponse.json({ submissions: rankedSubmissions });
    } catch (error: unknown) {
        console.error('[SUBMISSIONS_GET_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
