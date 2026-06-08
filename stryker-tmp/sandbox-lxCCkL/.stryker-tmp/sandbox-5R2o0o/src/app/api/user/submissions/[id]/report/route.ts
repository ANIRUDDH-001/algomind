// @ts-nocheck
// 
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

//  -- automated unused local suppression
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createServerSupabase();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch submission & verify candidate ownership
        const { data: submission, error: submissionError } = await supabase
            .from('candidate_submissions')
            .select(`
                *,
                assessment_campaigns(title, time_limit_mins, show_score_to_candidate)
            `)
            .eq('id', id)
            .eq('candidate_id', user.id)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        const campaignData = submission.assessment_campaigns;
        const campaign = Array.isArray(campaignData) ? campaignData[0] : campaignData;

        if (!campaign || !campaign.show_score_to_candidate) {
            return NextResponse.json({ error: 'Results are not available to candidates for this campaign' }, { status: 403 });
        }

        let assessment = null;
        if (submission.session_id) {
            const { data: assessmentData } = await supabase
                .from('assessments')
                .select('*')
                .eq('session_id', submission.session_id)
                .single();
            assessment = assessmentData;
        }

        // 2. Fetch Problem Details for Breakdown
        const problemIds = (submission.question_states || []).map((qs: any) => qs.problem_id).filter(Boolean);
        let problems: any[] = [];
        if (problemIds.length > 0) {
            const { data: problemsData } = await supabase
                .from('problems')
                .select('id, title, difficulty')
                .in('id', problemIds);
            problems = problemsData || [];
        }

        // 3. Construct response (omit transcript for candidates if desired, but let's leave it out to keep it clean)
        const questionsResponse = (submission.question_states || []).map((qs: any) => {
            const prob = problems.find(p => p.id === qs.problem_id);
            return {
                title: prob ? prob.title : 'Unknown Question',
                difficulty: prob ? prob.difficulty : 'unknown',
                status: qs.status,
                timeSpentMins: qs.elapsed_secs ? parseFloat((qs.elapsed_secs / 60).toFixed(1)) : 0,
                timeLimitMins: qs.time_limit_mins || campaign.time_limit_mins,
            };
        });

        const report = {
            candidate: {
                name: submission.candidate_name,
                email: submission.candidate_email,
                startedAt: submission.created_at,
                completedAt: submission.status === 'completed' ? submission.updated_at : null,
                lastActiveAt: submission.updated_at
            },
            campaign: {
                title: campaign.title,
                totalTimeMins: campaign.time_limit_mins
            },
            questions: questionsResponse,
            scores: assessment ? {
                overall: submission.overall_score,
                problem_decomposition: assessment.problem_decomposition,
                pattern_recognition: assessment.pattern_recognition,
                algorithmic_thinking: assessment.algorithmic_thinking,
                complexity_analysis: assessment.complexity_analysis,
                communication_clarity: assessment.communication_clarity,
                edge_case_awareness: assessment.edge_case_awareness,
                optimization_mindset: assessment.optimization_mindset,
                debugging_approach: assessment.debugging_approach
            } : null,
            overallFeedback: assessment?.overall_feedback || null,
            nextSteps: Array.isArray(assessment?.next_steps) ? assessment.next_steps : []
        };

        return NextResponse.json(report);

    } catch (error: unknown) {
        console.error('[CANDIDATE_REPORT_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
