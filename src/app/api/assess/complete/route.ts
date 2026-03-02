import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import * as jose from 'jose';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import { validateEnv } from '@/lib/startup/validateEnv';

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        let { sessionToken, transcript, duration, questionStates, totalDuration, integrityFlags } = body;

        // Normalize if old format was sent
        if (!questionStates && transcript) {
            questionStates = [{
                transcript: transcript,
                elapsed_secs: duration || 0
            }];
            totalDuration = duration || 0;
        }

        if (!sessionToken || !Array.isArray(questionStates) || questionStates.length === 0) {
            return NextResponse.json(
                { error: 'Invalid payload: missing sessionToken or questionStates' },
                { status: 400 }
            );
        }

        const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!jwtSecret) {
            console.error('[Security] No JWT secret available — SUPABASE_JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY are both unset');
            return NextResponse.json(
                { error: 'Server misconfiguration. Contact administrator.' },
                { status: 500 }
            );
        }
        const secret = new TextEncoder().encode(jwtSecret);

        const supabase = await createServerSupabase();
        const supabaseAdmin = getServiceClient();

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Complete API] Invalid session token', error);
            return NextResponse.json({ error: 'Invalid or expired session. Cannot complete assessment.' }, { status: 401 });
        }

        const submissionId = payload.submissionId as string;
        const campaignId = payload.campaignId as string;

        // 2. Ensure submission hasn't already been completed
        const { data: submission, error: subError } = await supabaseAdmin
            .from('candidate_submissions')
            .select('status, campaign_id, assigned_problem_id')
            .eq('id', submissionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        if (submission.status === 'completed') {
            return NextResponse.json({ error: 'Assessment already completed' }, { status: 400 });
        }

        // 3. Fetch Campaign to know who it belongs to
        const { data: campaign } = await supabaseAdmin
            .from('assessment_campaigns')
            .select('created_by, problem_id')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        // 4. Run Assessment on Each Question
        let totalScoreSum = 0;
        let totalWeightSum = 0;

        let aggProblemDecomp = 0;
        let aggPatternRecog = 0;
        let aggAlgThinking = 0;
        let aggComplexity = 0;
        let aggCommClarity = 0;
        let aggEdgeCase = 0;
        let aggOptimization = 0;
        let aggDebugging = 0;

        let allFeedbacks: string[] = [];
        let allNextSteps: string[] = [];

        // For backwards compatibility and saving the interview session properly:
        // We will combine transcripts or find the primary problem context.
        let combinedTranscript: any[] = [];
        let primaryProblemId = submission.assigned_problem_id || campaign.problem_id;
        let primaryProblemTitle = "Multiple Problems";

        const analyzer = new CognitiveAnalyzer();

        for (const qs of questionStates) {
            if (!qs.problem_id) continue;

            const turnTranscript = qs.transcript || [];
            if (turnTranscript.length === 0) continue; // Skip if they didn't do anything

            combinedTranscript = combinedTranscript.concat(turnTranscript);

            const { data: problem } = await supabaseAdmin
                .from('problems')
                .select('title, description, difficulty')
                .eq('id', qs.problem_id)
                .single();

            if (!problem) continue;

            primaryProblemTitle = problem.title; // Will just take the last active one if multiple, which is fine for the simplified row

            const normalizedTranscript = turnTranscript.map((turn: any) => ({
                role: (turn.speaker === 'ai' ? 'assistant' : turn.speaker) as 'user' | 'assistant' | 'system',
                content: turn.text,
            }));

            // Generate a temporary UUID for the analyzer output format
            const tempSessionId = crypto.randomUUID();
            let result;
            try {
                result = await analyzer.analyze(tempSessionId, problem, normalizedTranscript);
            } catch (analyzeError) {
                console.error(`[Assess Complete] analyzer failed for problem ${qs.problem_id}:`, analyzeError);
                continue; // Skip this one, keep analyzing others
            }

            // Calculate overall score for this question
            const qsScore = Object.values(result.skills).reduce((acc: any, s: any) => acc + s.score, 0) / Object.keys(result.skills).length;

            // Weight can be elapsed_secs, if 0 fallback to 1 
            const weight = Math.max(qs.elapsed_secs || 1, 1);

            totalScoreSum += qsScore * weight;
            totalWeightSum += weight;

            const skills = result.skills as Record<string, { score: number }>;
            aggProblemDecomp += (skills.problem_decomposition?.score || 0) * weight;
            aggPatternRecog += (skills.pattern_recognition?.score || 0) * weight;
            aggAlgThinking += (skills.algorithmic_thinking?.score || 0) * weight;
            aggComplexity += (skills.complexity_analysis?.score || 0) * weight;
            aggCommClarity += (skills.communication_clarity?.score || 0) * weight;
            aggEdgeCase += (skills.edge_case_awareness?.score || 0) * weight;
            aggOptimization += (skills.optimization_mindset?.score || 0) * weight;
            aggDebugging += (skills.debugging_approach?.score || 0) * weight;

            allFeedbacks.push(`**Problem: ${problem.title}**\n${result.overallFeedback}`);
            if (result.nextSteps?.length) {
                allNextSteps = allNextSteps.concat(result.nextSteps);
            }
        }

        if (totalWeightSum === 0) {
            // Failsafe if we somehow evaluated nothing
            totalWeightSum = 1;
        }

        const overallScore = totalScoreSum / totalWeightSum;

        // 5. Insert Interview Session 
        const { data: sessionData, error: sessionError } = await supabaseAdmin
            .from('interview_sessions')
            .insert({
                user_id: null,
                is_candidate_session: true,
                problem_id: primaryProblemId,
                problem_title: primaryProblemTitle,
                transcript: combinedTranscript,
                duration: totalDuration || 0,
                status: 'completed',
                overall_score: overallScore,
                completed_at: new Date().toISOString()
            })
            .select()
            .single();

        if (sessionError) {
            throw sessionError;
        }

        // 6. Insert detailed Assessment
        const { data: _assessmentData, error: assessmentError } = await supabaseAdmin
            .from('assessments')
            .insert({
                session_id: sessionData.id,
                user_id: null,
                overall_score: overallScore,
                problem_decomposition: aggProblemDecomp / totalWeightSum,
                pattern_recognition: aggPatternRecog / totalWeightSum,
                algorithmic_thinking: aggAlgThinking / totalWeightSum,
                complexity_analysis: aggComplexity / totalWeightSum,
                communication_clarity: aggCommClarity / totalWeightSum,
                edge_case_awareness: aggEdgeCase / totalWeightSum,
                optimization_mindset: aggOptimization / totalWeightSum,
                debugging_approach: aggDebugging / totalWeightSum,
                overall_feedback: allFeedbacks.join('\n\n'),
                next_steps: allNextSteps.slice(0, 5), // Keep it reasonable
                skill_evidence: {} // We clear this out or can implement a merged version
            })
            .select()
            .single();

        if (assessmentError) {
            throw assessmentError;
        }

        // 7. Update Candidate Submission status
        const { error: finalSubError } = await supabaseAdmin
            .from('candidate_submissions')
            .update({
                status: 'completed',
                session_id: sessionData.id,
                overall_score: overallScore,
                integrity_flags: integrityFlags || []
            })
            .eq('id', submissionId);

        if (finalSubError) {
            throw finalSubError;
        }

        return NextResponse.json({ success: true, overallScore });

    } catch (error: unknown) {
        console.error('[CANDIDATE_COMPLETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error processing assessment' }, { status: 500 });
    }
}
