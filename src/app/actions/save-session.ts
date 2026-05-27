'use server';

import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { updateKaiMemory, type SessionData } from '@/lib/ai/memory-generator';
import { createAndSaveSession1Baseline } from '@/lib/ai/narrative-generator';
import { logSystemEvent } from '@/lib/monitoring/events';
import { type ConversationTurn } from '@/lib/assessment/prompts';
import { addToQueue, updateSkillRepetition } from '@/lib/spaced-repetition/queue';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { err, ok, type Result } from '@/lib/api/result';

type SaveInterviewSessionData = {
    sessionId?: string;
    assessmentPending?: boolean;
    bypassed?: boolean;
};

export async function saveInterviewSession(
    userId: string,
    problemId: string,
    problemTitle: string,
    transcript: ConversationTurn[],
    durationSeconds?: number,
    result?: AssessmentResult,
    options?: {
        readOnly?: boolean;
        startTime?: number;
        endTime?: number;
        difficultyMode?: 'warm-up' | 'practice' | 'crunch' | 'sprint';
        isAdmin?: boolean;
    }
): Promise<Result<SaveInterviewSessionData>> {
    if (options?.readOnly) {
        return ok({ bypassed: true });
    }

    const supabase = await createClient();

    // 1. Auth Check (Requirement 2)
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
        console.error('❌ [ACTION] Auth validation failed:', { authError, userId });
        return err('Unauthorized', 'unauthorized');
    }

    try {
        // Calculate duration if not provided but timestamps are (Requirement 8)
        let finalDuration = durationSeconds ?? 0;
        if (!durationSeconds && options?.startTime && options?.endTime) {
            finalDuration = Math.floor((options.endTime - options.startTime) / 1000);
        }

        // Profile mapping
        await supabase.rpc('ensure_learner_profile', { p_user_id: userId });

        // Save session atomically without assessment
        const { data: atomicSaveData, error: atomicSaveError } = await supabase
            .rpc('save_interview_session_atomic', {
                p_user_id: userId,
                p_problem_id: problemId,
                p_problem_title: problemTitle,
                p_transcript: transcript,
                p_duration: finalDuration,
                p_feedback: null,
                p_overall_score: 0,
                p_raw_score: null,
                p_adjusted_score: null,
                p_status: 'completed',
                p_difficulty_mode: options?.difficultyMode ?? 'practice',
                p_is_candidate_session: false,
                p_create_assessment: false,
                p_assessment_adjusted_score: null,
                p_assessment_overall_feedback: null,
                p_assessment_next_steps: null,
                p_assessment_skill_evidence: null,
                p_assessment_hire_decision: null,
                p_assessment_problem_decomposition: null,
                p_assessment_pattern_recognition: null,
                p_assessment_algorithmic_thinking: null,
                p_assessment_complexity_analysis: null,
                p_assessment_communication_clarity: null,
                p_assessment_edge_case_awareness: null,
                p_assessment_optimization_mindset: null,
                p_assessment_debugging_approach: null,
                p_assessment_model_used: 'unknown',
                p_assessment_confidence: 0,
                p_assessment_validation_pass_done: false,
                p_assessment_code_quality: null,
                p_assessment_sub_criteria: null,
                p_assessment_difficulty_mode: options?.difficultyMode ?? 'practice',
            });

        const atomicSaveRow = Array.isArray(atomicSaveData)
            ? atomicSaveData[0]
            : atomicSaveData;

        if (atomicSaveError || !atomicSaveRow?.session_id) {
            const message = atomicSaveError?.message ?? 'Atomic session save failed';
            console.error('❌ [ACTION] Failed to save session atomically:', atomicSaveError ?? atomicSaveData);
            void logSystemEvent({ type: 'db_error', errorMessage: message, metadata: { operation: 'save_session_atomic' } });
            return err(message, 'db_error');
        }

        const sessionId = atomicSaveRow.session_id;

        // Task C: Minimum turn enforcement
        const userTurns = transcript.filter((t) => t.role === 'user').length;
        const minTurns = options?.isAdmin ? 1 : 2;

        if (userTurns >= minTurns && transcript.length > 0) {
            // Trigger Inngest background assessment
            const { inngest } = await import('@/lib/inngest/client');
            await inngest.send({
                name: 'interview/assess',
                data: { sessionId, userId }
            });
        } else {
            console.warn(`⚠️ [ACTION] Insufficient turns for assessment (${userTurns} < ${minTurns}). Skipping AI analysis.`);
        }

        return ok({ sessionId, assessmentPending: userTurns >= minTurns });
    } catch (e) {
        const error = e as unknown;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [ACTION] Unexpected error in saveInterviewSession:', error);
        void logSystemEvent({ type: 'db_error', errorMessage, metadata: { operation: 'save_session' } });
        return err(errorMessage, 'unexpected_error');
    }
}

/**
 * Re-run AI scoring for a session that has no assessment row.
 * Called from the analysis page when assessment is missing.
 */
export async function retryAssessment(sessionId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Unauthorized' };

    // Fetch the session — must belong to this user
    const { data: session, error: sessionErr } = await supabase
        .from('interview_sessions')
        .select('id, user_id, problem_id, problem_title, transcript, duration, difficulty_mode')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

    if (sessionErr || !session) {
        return { success: false, error: 'Session not found' };
    }

    // Check no assessment already exists (prevent duplicate)
    const { data: existing } = await supabase
        .from('assessments')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (existing) {
        return { success: false, error: 'Assessment already exists' };
    }

    // Re-run the analyzer
    try {
        const { CognitiveAnalyzer } = await import('@/lib/assessment/analyzer');
        const analyzer = new CognitiveAnalyzer();

        const { data: prob } = await supabase
            .from('problems')
            .select('description, difficulty')
            .eq('id', session.problem_id)
            .single();

        const transcript = Array.isArray(session.transcript) ? session.transcript : [];
        const result = await analyzer.analyze(
            sessionId,
            {
                title: session.problem_title || '',
                description: prob?.description || '',
                difficulty: prob?.difficulty || 'medium'
            },
            transcript as any[]
        );

        // Save the assessment row
        const skills = result.skills || {};
        const isWarmUp = session.difficulty_mode === 'warm-up';

        const { error: insertErr } = await supabase
            .from('assessments')
            .insert({
                session_id: sessionId,
                user_id: user.id,
                overall_score: result.rawScore ?? 0,
                adjusted_score: result.adjustedScore ?? null,
                overall_feedback: result.overallFeedback,
                next_steps: result.nextSteps,
                skill_evidence: { ...result.skills, keyMoments: result.keyMoments || [], improvementExamples: result.improvementExamples || [] },
                hire_decision: isWarmUp ? null : (result.hireDecision ?? null),
                problem_decomposition: (skills['problem-decomposition'] as any)?.score ?? null,
                pattern_recognition: (skills['pattern-recognition'] as any)?.score ?? null,
                algorithmic_thinking: (skills['algorithmic-thinking'] as any)?.score ?? null,
                complexity_analysis: (skills['complexity-analysis'] as any)?.score ?? null,
                communication_clarity: (skills['communication-clarity'] as any)?.score ?? null,
                edge_case_awareness: (skills['edge-case-awareness'] as any)?.score ?? null,
                optimization_mindset: (skills['optimization-mindset'] as any)?.score ?? null,
                debugging_approach: (skills['debugging-approach'] as any)?.score ?? null,
                model_used: result.modelUsed ?? 'unknown',
                confidence: 0.8,
                validation_pass_done: result.validationPassDone ?? false,
                sub_criteria: Object.fromEntries(
                    Object.entries(skills).map(([k, v]) => [k, (v as any).subCriteria || {}])
                )
            });

        if (insertErr) {
            return { success: false, error: insertErr.message };
        }

        return { success: true };
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Analysis failed';
        return { success: false, error: msg };
    }
}
