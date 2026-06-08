/**
 * @codesage
 * @file      src/app/api/employer/submissions/[campaignId]/report/[submissionId]/route.ts
 * @purpose   Retrieves a detailed assessment report for a specific candidate submission.
 * @tech      Next.js, Supabase
 * @connects  @/lib/supabase/server, @/lib/auth/require-employer
 * @apis      None
 * @db        assessment_campaigns, candidate_submissions, assessments, interview_sessions, problems
 * @state     None
 * @env       None
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { requireEmployer } from '@/lib/auth/require-employer';

//  -- automated unused local suppression
export async function GET(req: NextRequest, { params }: { params: Promise<{ campaignId: string, submissionId: string }> }) {
    try {
        const { campaignId, submissionId } = await params;
        const auth = await requireEmployer();

        if (auth.error || !auth.user) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const supabase = await createServerSupabase();

        // 1. Verify employer owns the campaign & fetch title
        const { data: campaign, error: campaignError } = await supabase
            .from('assessment_campaigns')
            .select('id, title, time_limit_mins')
            .eq('id', campaignId)
            .eq('created_by', auth.user.id)
            .single();

        if (campaignError || !campaign) {
            return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
        }

        // 2. Fetch submission & assessment
        const { data: submission, error: submissionError } = await supabase
            .from('candidate_submissions')
            .select('*')
            .eq('id', submissionId)
            .eq('campaign_id', campaignId)
            .single();

        if (submissionError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        let assessment = null;
        let originalSession = null;
        if (submission.session_id) {
            const { data: assessmentData } = await supabase
                .from('assessments')
                .select('*')
                .eq('session_id', submission.session_id)
                .single();
            assessment = assessmentData;

            const { data: sessionData } = await supabase
                .from('interview_sessions')
                .select('transcript, problem_title, duration')
                .eq('id', submission.session_id)
                .single();
            if (sessionData) originalSession = sessionData;
        }

        // 3. Fetch Problem Details for Breakdown
        const problemIds = (submission.question_states || []).map((qs: any) => qs.problem_id).filter(Boolean);
        let problems: any[] = [];
        if (problemIds.length > 0) {
            const { data: problemsData } = await supabase
                .from('problems')
                .select('id, title, difficulty')
                .in('id', problemIds);
            problems = problemsData || [];
        }

        // 4. Construct response
        const hasQuestionStates = submission.question_states && Array.isArray(submission.question_states) && submission.question_states.length > 0;

        const questionsResponse = hasQuestionStates
            ? submission.question_states.map((qs: any) => {
                const prob = problems.find(p => p.id === qs.problem_id);
                return {
                    title: prob ? prob.title : 'Unknown Question',
                    difficulty: prob ? prob.difficulty : 'unknown',
                    status: qs.status,
                    timeSpentMins: qs.elapsed_secs ? parseFloat((qs.elapsed_secs / 60).toFixed(1)) : 0,
                    timeLimitMins: qs.time_limit_mins || campaign.time_limit_mins,
                    transcript: qs.transcript || []
                };
            })
            : originalSession ? [{
                title: originalSession.problem_title || 'Unknown Question',
                difficulty: 'unknown',
                status: submission.status,
                timeSpentMins: originalSession.duration ? parseFloat((originalSession.duration / 60).toFixed(1)) : 0,
                timeLimitMins: campaign.time_limit_mins,
                transcript: originalSession.transcript || []
            }] : [];

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
        console.error('[SUBMISSION_REPORT_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
