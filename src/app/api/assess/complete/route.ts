import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import * as jose from 'jose';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import { validateEnv } from '@/lib/startup/validateEnv';

validateEnv();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sessionToken, transcript, duration, _finalCode } = body;

        if (!sessionToken || !Array.isArray(transcript) || transcript.length === 0) {
            return NextResponse.json(
                { error: 'Invalid transcript: must be a non-empty array' },
                { status: 400 }
            );
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            console.error('[Security] SUPABASE_SERVICE_ROLE_KEY is not set — refusing to sign JWT');
            return NextResponse.json(
                { error: 'Server misconfiguration. Contact administrator.' },
                { status: 500 }
            );
        }
        const secret = new TextEncoder().encode(serviceKey);

        const supabase = await createServerSupabase();

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
        // Normalize transcript from CandidateInterview format { speaker, text }
        // to CognitiveAnalyzer format { role, content }
        const normalizedTranscript = (transcript as Array<{ speaker: string; text: string }>).map((turn) => ({
            role: (turn.speaker === 'ai' ? 'assistant' : turn.speaker) as 'user' | 'assistant' | 'system',
            content: turn.text,
        }));

        const analyzer = new CognitiveAnalyzer();
        // Generate a temporary UUID for the analyzer output format
        const tempSessionId = crypto.randomUUID();
        let result;
        try {
            result = await analyzer.analyze(tempSessionId, problem, normalizedTranscript);
        } catch (analyzeError) {
            console.error('[Assess Complete] CognitiveAnalyzer.analyze() failed:', analyzeError);
            return NextResponse.json(
                { error: 'Failed to analyze assessment. Please try again.' },
                { status: 500 }
            );
        }

        // Calculate overall score
        const overallScore = Object.values(result.skills).reduce((acc, s) => acc + s.score, 0) / Object.keys(result.skills).length;

        // 5. Insert Interview Session with null user_id so it never appears in employer
        //    dashboard queries (which filter by user_id). Link back to employer is via
        //    candidate_submissions.session_id set in step 7.
        const { data: sessionData, error: sessionError } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: null,              // Candidate sessions are not owned by any user
                is_candidate_session: true, // Explicit flag for candidate-specific queries
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
        const { data: _assessmentData, error: assessmentError } = await supabase
            .from('assessments')
            .insert({
                session_id: sessionData.id,
                user_id: null, // Candidate session — not attributed to any user
                overall_score: overallScore,
                problem_decomposition: (result.skills as Record<string, { score: number }>).problem_decomposition?.score || 0,
                pattern_recognition: (result.skills as Record<string, { score: number }>).pattern_recognition?.score || 0,
                algorithmic_thinking: (result.skills as Record<string, { score: number }>).algorithmic_thinking?.score || 0,
                complexity_analysis: (result.skills as Record<string, { score: number }>).complexity_analysis?.score || 0,
                communication_clarity: (result.skills as Record<string, { score: number }>).communication_clarity?.score || 0,
                edge_case_awareness: (result.skills as Record<string, { score: number }>).edge_case_awareness?.score || 0,
                optimization_mindset: (result.skills as Record<string, { score: number }>).optimization_mindset?.score || 0,
                debugging_approach: (result.skills as Record<string, { score: number }>).debugging_approach?.score || 0,
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

    } catch (error: unknown) {
        console.error('[CANDIDATE_COMPLETE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error processing assessment' }, { status: 500 });
    }
}
