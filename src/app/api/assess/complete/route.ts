import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as jose from 'jose';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionToken, transcript, duration, finalCode } = body;

        if (!sessionToken || !transcript || !Array.isArray(transcript)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // 1. Validate candidate JWT securely
        let payload;
        try {
            const secret = new TextEncoder().encode(process.env.SUPABASE_SERVICE_ROLE_KEY || 'development_secret');
            const { payload: decoded } = await jose.jwtVerify(sessionToken, secret);
            payload = decoded;
        } catch (error) {
            console.error('⛔ [Assess Complete API] Invalid session token', error);
            return NextResponse.json({ error: 'Invalid or expired session. Cannot complete assessment.' }, { status: 401 });
        }

        const submissionId = payload.submissionId as string;
        const campaignId = payload.campaignId as string;

        // 2. Ensure submission hasn't already been completed
        const { data: submission, error: subError } = await supabase
            .from('candidate_submissions')
            .select('status, campaign_id')
            .eq('id', submissionId)
            .single();

        if (subError || !submission) {
            return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
        }

        if (submission.status === 'completed') {
            return NextResponse.json({ error: 'Assessment already completed' }, { status: 400 });
        }

        // 3. Fetch Campaign and Problem to feed the analyzer
        const { data: campaign } = await supabase
            .from('assessment_campaigns')
            .select('created_by, problem_id')
            .eq('id', campaignId)
            .single();

        if (!campaign) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }

        const { data: problem } = await supabase
            .from('problems')
            .select('title, description, difficulty')
            .eq('id', campaign.problem_id)
            .single();

        if (!problem) {
            return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
        }

        // 4. Run Assessment
        const analyzer = new CognitiveAnalyzer();
        // Generate a temporary UUID for the analyzer output format
        const tempSessionId = crypto.randomUUID();
        const result = await analyzer.analyze(tempSessionId, problem, transcript);

        // Calculate overall score
        const overallScore = Object.values(result.skills).reduce((acc, s) => acc + s.score, 0) / Object.keys(result.skills).length;

        // 5. Insert Interview Session using Employer's ID to preserve RLS policies for problem history if needed
        const { data: sessionData, error: sessionError } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: campaign.created_by, // Attribute it to the employer
                problem_id: campaign.problem_id,
                problem_title: problem.title,
                transcript: transcript,
                duration: duration || 0,
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
        const { data: assessmentData, error: assessmentError } = await supabase
            .from('assessments')
            .insert({
                session_id: sessionData.id,
                user_id: campaign.created_by, // Again, employer
                overall_score: overallScore,
                problem_decomposition: (result.skills as any).problem_decomposition?.score || 0,
                pattern_recognition: (result.skills as any).pattern_recognition?.score || 0,
                algorithmic_thinking: (result.skills as any).algorithmic_thinking?.score || 0,
                complexity_analysis: (result.skills as any).complexity_analysis?.score || 0,
                communication_clarity: (result.skills as any).communication_clarity?.score || 0,
                edge_case_awareness: (result.skills as any).edge_case_awareness?.score || 0,
                optimization_mindset: (result.skills as any).optimization_mindset?.score || 0,
                debugging_approach: (result.skills as any).debugging_approach?.score || 0,
                overall_feedback: result.overallFeedback,
                next_steps: result.nextSteps,
                skill_evidence: result.skills // Storing the full rich JSON with evidence/strengths
            })
            .select()
            .single();

        if (assessmentError) {
            throw assessmentError;
        }

        // 7. Update Candidate Submission status
        const { error: finalSubError } = await supabase
            .from('candidate_submissions')
            .update({
                status: 'completed',
                session_id: sessionData.id,
                overall_score: overallScore,
                completed_at: new Date().toISOString()
            })
            .eq('id', submissionId);

        if (finalSubError) {
            throw finalSubError;
        }

        return NextResponse.json({ success: true, overallScore });

    } catch (error: any) {
        console.error('[CANDIDATE_COMPLETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error processing assessment' }, { status: 500 });
    }
}
