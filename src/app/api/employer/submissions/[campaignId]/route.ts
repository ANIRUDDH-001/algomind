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

        // 2. Fetch all submissions matching the campaign
        const { data: submissions, error: submissionsError } = await supabase
            .from('candidate_submissions')
            .select(`
                id,
                candidate_name,
                candidate_email,
                status,
                overall_score,
                created_at,
                assessments (
                    problem_decomposition,
                    pattern_recognition,
                    algorithmic_thinking,
                    complexity_analysis,
                    communication_clarity,
                    edge_case_awareness,
                    optimization_mindset,
                    debugging_approach,
                    overall_feedback
                )
            `)
            .eq('campaign_id', campaignId)
            .order('overall_score', { ascending: false, nullsFirst: false });

        if (submissionsError) {
            throw submissionsError;
        }

        // Compute rank based on sorted order. Items without an overall score fall to the bottom.
        let currentRank = 1;
        const rankedSubmissions = submissions.map((sub, index) => {
            const hasScore = typeof sub.overall_score === 'number' || !isNaN(Number(sub.overall_score));
            const rank = hasScore && sub.overall_score !== null ? currentRank++ : null;

            // Extract embedded assessment details safely
            const assessment = Array.isArray(sub.assessments) ? sub.assessments[0] : sub.assessments;

            return {
                id: sub.id,
                candidate_name: sub.candidate_name,
                candidate_email: sub.candidate_email,
                status: sub.status,
                overall_score: sub.overall_score,
                created_at: sub.created_at,
                rank,
                skills: assessment ? {
                    problem_decomposition: assessment.problem_decomposition,
                    pattern_recognition: assessment.pattern_recognition,
                    algorithmic_thinking: assessment.algorithmic_thinking,
                    complexity_analysis: assessment.complexity_analysis,
                    communication_clarity: assessment.communication_clarity,
                    edge_case_awareness: assessment.edge_case_awareness,
                    optimization_mindset: assessment.optimization_mindset,
                    debugging_approach: assessment.debugging_approach
                } : null,
                feedback: assessment?.overall_feedback || null
            };
        });

        return NextResponse.json({ submissions: rankedSubmissions });
    } catch (error: unknown) {
        console.error('[SUBMISSIONS_GET_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
