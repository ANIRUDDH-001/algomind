/**
 * @codesage
 * @file      src/app/actions/save-session.ts
 * @purpose   Server action to save interview session and assessment results
 * @tech      Next.js Server Actions, Supabase, AI
 * @connects  @/lib/supabase/server, AI Analyzer, Memory Generator
 * @apis      None
 * @db        interview_sessions, assessments, learner_profiles, knowledge_gaps
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

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

        // 2. Assessment Logic (Requirement 4)
        let finalResult = result;
        if (!finalResult && transcript.length > 0) {
            // Task C: Minimum turn enforcement
            const userTurns = transcript.filter((t) => t.role === 'user').length;
            const minTurns = options?.isAdmin ? 1 : 2;  // B2: lowered from 3 to 2

            if (userTurns < minTurns) {
                console.warn(`⚠️ [ACTION] Insufficient turns for assessment (${userTurns} < ${minTurns}). Skipping AI analysis.`);
                // void logSystemEvent({ type: 'assessment_insufficient', metadata: { userTurns, minTurns, problemId, userId } });

                // Construct zero-score result
                finalResult = {
                    sessionId: crypto.randomUUID(),
                    timestamp: new Date(),
                    problem: { title: problemTitle, description: '', difficulty: 'medium' },
                    skills: {} as any, // 0 overall score
                    overallFeedback: 'Your session had too little discussion for accurate scoring. Try engaging more with KAI.',
                    nextSteps: ['Share your thought process, write code, and explain your reasoning to get a full assessment.'],
                    knowledgeGaps: [],
                    analysisFailure: 'user_fault'
                } as unknown as AssessmentResult;
            } else {
                try {
                    const { CognitiveAnalyzer } = await import('@/lib/assessment/analyzer');
                    const analyzer = new CognitiveAnalyzer();
                    // We need the problem description/difficulty to analyze properly
                    const { data: prob } = await supabase
                        .from('problems')
                        .select('description, difficulty')
                        .eq('id', problemId)
                        .single();

                    finalResult = await analyzer.analyze(
                        crypto.randomUUID(), // TASK A: Already using crypto.randomUUID()
                        { title: problemTitle, description: prob?.description || '', difficulty: prob?.difficulty || 'medium' },
                        transcript
                    );
                } catch (err) {
                    console.error('⚠️ [ACTION] AI Assessment failed, saving session without full assessment:', err);
                    // Fallback result for Requirement 4
                    finalResult = {
                        sessionId: crypto.randomUUID(),
                        timestamp: new Date(),
                        problem: { title: problemTitle, description: '', difficulty: 'medium' },
                        skills: {},
                        overallFeedback: 'Our AI analysis encountered an issue. Scores may update shortly upon retry.',
                        nextSteps: ['Your session has been saved. Scores will be updated once AI analysis completes.'],
                        knowledgeGaps: [],
                        analysisFailure: 'system_fault'
                    } as unknown as AssessmentResult;
                }
            }
        }

        // Profile mapping
        await supabase.rpc('ensure_learner_profile', { p_user_id: userId });

        // Calculate score
        const skillValues = Object.values(finalResult?.skills || {});
        const overallScore = skillValues.length > 0
            ? skillValues.reduce((acc, s) => acc + (s as any).score, 0) / skillValues.length
            : 0;

        // 3. Save session + assessment atomically (Requirement 5/6)
        const skills: Record<string, any> = (finalResult?.skills || {}) as Record<string, any>;
        const isWarmUp = options?.difficultyMode === 'warm-up';
        const hireDecision = isWarmUp ? null : (finalResult?.hireDecision ?? null);
        const subCriteria = finalResult
            ? Object.fromEntries(
                Object.entries(skills).map(([k, v]) => [k, (v as any).subCriteria || {}])
            )
            : null;

        const { data: atomicSaveData, error: atomicSaveError } = await supabase
            .rpc('save_interview_session_atomic', {
                p_user_id: userId,
                p_problem_id: problemId,
                p_problem_title: problemTitle,
                p_transcript: transcript,
                p_duration: finalDuration,
                p_feedback: finalResult ?? null,
                p_overall_score: overallScore,
                p_raw_score: finalResult?.rawScore ?? null,
                p_adjusted_score: finalResult?.adjustedScore ?? null,
                p_status: 'completed',
                p_difficulty_mode: options?.difficultyMode ?? 'practice',
                p_is_candidate_session: false,
                p_create_assessment: Boolean(finalResult),
                p_assessment_adjusted_score: finalResult?.adjustedScore ?? null,
                p_assessment_overall_feedback: finalResult?.overallFeedback ?? null,
                p_assessment_next_steps: finalResult?.nextSteps ?? null,
                p_assessment_skill_evidence: finalResult?.skills ?? null,
                p_assessment_hire_decision: hireDecision,
                p_assessment_problem_decomposition: (skills['problem-decomposition'] as any)?.score ?? null,
                p_assessment_pattern_recognition: (skills['pattern-recognition'] as any)?.score ?? null,
                p_assessment_algorithmic_thinking: (skills['algorithmic-thinking'] as any)?.score ?? null,
                p_assessment_complexity_analysis: (skills['complexity-analysis'] as any)?.score ?? null,
                p_assessment_communication_clarity: (skills['communication-clarity'] as any)?.score ?? null,
                p_assessment_edge_case_awareness: (skills['edge-case-awareness'] as any)?.score ?? null,
                p_assessment_optimization_mindset: (skills['optimization-mindset'] as any)?.score ?? null,
                p_assessment_debugging_approach: (skills['debugging-approach'] as any)?.score ?? null,
                p_assessment_model_used: finalResult?.modelUsed ?? 'unknown',
                p_assessment_confidence: 0.8,
                p_assessment_validation_pass_done: finalResult?.validationPassDone ?? false,
                p_assessment_code_quality: finalResult?.codeQuality ?? null,
                p_assessment_sub_criteria: subCriteria,
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

        // 5. Post-commit non-critical updates
        if (finalResult) {

            // Hire readiness trend tracking
            if (hireDecision) {
                try {
                    const { data: diffData } = await supabase
                        .from('problems')
                        .select('difficulty')
                        .eq('id', problemId)
                        .maybeSingle();

                    const newEntry = {
                        sessionId,
                        hireDecision,
                        score: finalResult.adjustedScore ?? overallScore,
                        completedAt: new Date().toISOString(),
                        problemDifficulty: diffData?.difficulty || 'medium',
                    };

                    const { data: profile } = await supabase
                        .from('learner_profiles')
                        .select('hire_readiness_trend')
                        .eq('user_id', userId)
                        .maybeSingle();

                    const trend = [...((profile?.hire_readiness_trend as any[]) ?? []), newEntry].slice(-20);

                    await supabase.from('learner_profiles')
                        .upsert({ user_id: userId, hire_readiness_trend: trend });
                } catch (trendErr) {
                    console.error('[save-session] hire_readiness_trend update failed:', trendErr);
                }
            }
        }

        // Knowledge Gaps
        if (finalResult?.knowledgeGaps && finalResult.knowledgeGaps.length > 0) {
            const gapsToInsert = finalResult.knowledgeGaps.map(gap => ({
                user_query: gap,
                gap_reason: 'Identified during AI assessment',
                session_id: sessionId,
                user_id: userId,
                status: 'new',
                priority: 'medium',
                upvotes: 1
            }));

            await supabase.from('knowledge_gaps').insert(gapsToInsert);
        }

        // Memory & Spaced Rep
        const { data: probDiff } = await supabase
            .from('problems')
            .select('difficulty')
            .eq('id', problemId)
            .maybeSingle();

        try {
            await addToQueue({
                userId,
                problemId,
                problemTitle,
                problemDifficulty: probDiff?.difficulty || 'medium',
                overallScore: finalResult?.rawScore ?? 5,
                sessionStatus: finalResult?.analysisFailure === 'user_fault' ? 'incomplete' : undefined,
            });
        } catch (err) { console.error('[save-session] addToQueue failed:', err); }

        // Per-skill FSRS updates
        try {
            const skills: Record<string, any> = finalResult?.skills || {};
            const dimensionScores: Record<string, number> = {
                'problem-decomposition': (skills['problem-decomposition'] as any)?.score ?? 5,
                'pattern-recognition': (skills['pattern-recognition'] as any)?.score ?? 5,
                'algorithmic-thinking': (skills['algorithmic-thinking'] as any)?.score ?? 5,
                'complexity-analysis': (skills['complexity-analysis'] as any)?.score ?? 5,
                'communication-clarity': (skills['communication-clarity'] as any)?.score ?? 5,
                'edge-case-awareness': (skills['edge-case-awareness'] as any)?.score ?? 5,
                'optimization-mindset': (skills['optimization-mindset'] as any)?.score ?? 5,
                'debugging-approach': (skills['debugging-approach'] as any)?.score ?? 5,
            };
            await updateSkillRepetition({
                userId,
                sessionId,
                dimensionScores,
            });
        } catch (err) { console.error('[save-session] updateSkillRepetition failed:', err); }

        // Knowledge Graph update — makes interview scores visible to recommendation engine
        try {
            const { data: problemData } = await supabase
                .from('problems')
                .select('tags, primary_pattern')
                .eq('id', problemId)
                .maybeSingle();

            if (problemData) {
                await getKnowledgeGraphService().onInterviewSessionCompleted({
                    userId,
                    sessionId,
                    problemTags: problemData.tags ?? [],
                    primaryPattern: problemData.primary_pattern ?? null,
                    overallScore,
                });
            }
        } catch (err) {
            console.error('[save-session] KG update failed:', err);
            // Non-fatal — session already saved successfully
        }

        // Memory update — awaited so failure is catchable and logged properly
        try {
            await updateKaiMemory(userId);
        } catch (memErr) {
            console.error('[save-session] Kai memory update failed (non-fatal):', memErr);
            // Non-fatal: session is already saved. Memory will be stale for next session.
        }

        // Session 1 baseline — only runs once, must succeed
        try {
            const { count, error: countError } = await supabase
                .from('interview_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (!countError && count === 1 && finalResult) {
                const skillsForBaseline: Record<string, number> = {};
                for (const [key, value] of Object.entries(finalResult.skills)) {
                    skillsForBaseline[key] = (value as any).score ?? 5;
                }

                const sessionDataForBaseline: SessionData = {
                    sessionId,
                    problemTitle,
                    problemDifficulty: probDiff?.difficulty || 'medium',
                    overallScore: finalResult.rawScore ?? 0,
                    skills: skillsForBaseline,
                    completedAt: new Date().toISOString()
                };
                await createAndSaveSession1Baseline(userId, sessionDataForBaseline);
            }
        } catch (baselineErr) {
            console.error('[save-session] Session 1 baseline failed (non-fatal):', baselineErr);
            // Non-fatal: baseline is cosmetic. Student can still use the product.
        }
        try {
            const { invalidateDashboardCache } = await import('@/lib/cache/dashboardCache');
            await invalidateDashboardCache(userId);
        } catch (err) { console.error('[save-session] Cache invalidation failed:', err); }

        return ok({ sessionId });
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
                skill_evidence: result.skills,
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
