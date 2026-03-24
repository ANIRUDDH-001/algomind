'use server';

import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { updateKaiMemory, type SessionData } from '@/lib/ai/memory-generator';
import { createAndSaveSession1Baseline } from '@/lib/ai/narrative-generator';
import { logSystemEvent } from '@/lib/monitoring/events';
import { type ConversationTurn } from '@/lib/assessment/prompts';
import { addToQueue, updateSkillRepetition } from '@/lib/spaced-repetition/queue';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';

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
) {
    if (options?.readOnly) {
        return { success: true, bypassed: true };
    }

    const supabase = await createClient();

    // 1. Auth Check (Requirement 2)
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser || authUser.id !== userId) {
        console.error('❌ [ACTION] Auth validation failed:', { authError, userId });
        return { success: false, error: 'Unauthorized', status: 401 };
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

        // 3. Save Session (Requirement 5)
        const { data: sessionData, error } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: userId,
                problem_id: problemId,
                problem_title: problemTitle,
                transcript: transcript, // Requirement 3: handles empty transcript via db constraint or null
                duration: finalDuration,
                feedback: finalResult,
                overall_score: overallScore,
                raw_score: finalResult?.rawScore ?? null, // Added raw_score
                adjusted_score: finalResult?.adjustedScore ?? null, // Added adjusted_score
                created_at: new Date().toISOString(),
                status: 'completed',
                completed_at: new Date().toISOString(),
                is_candidate_session: false,
                difficulty_mode: options?.difficultyMode ?? 'practice',
            })
            .select()
            .single();

        if (error) {
            console.error('❌ [ACTION] Failed to save session:', error);
            void logSystemEvent({ type: 'db_error', errorMessage: error.message, metadata: { operation: 'save_session' } });
            return { success: false, error: error.message, status: 500 };
        }

        let assessmentPending = false;

        // 4. Save assessment details (Requirement 6)
        if (finalResult) {
            // Map skill keys (hyphenated) to DB columns (underscored)
            const skills = finalResult.skills || {};
            // Determine hire_decision — null for warm-up mode
            const isWarmUp = options?.difficultyMode === 'warm-up';
            const hireDecision = isWarmUp ? null : (finalResult.hireDecision ?? null);

            const { error: assessmentError } = await supabase
                .from('assessments')
                .insert({
                    session_id: sessionData.id,
                    user_id: userId,
                    overall_score: overallScore,
                    adjusted_score: finalResult.adjustedScore ?? null,
                    overall_feedback: finalResult.overallFeedback,
                    next_steps: finalResult.nextSteps,
                    skill_evidence: finalResult.skills,
                    hire_decision: hireDecision,
                    // ✅ FIX: Individual skill score columns
                    problem_decomposition: (skills['problem-decomposition'] as any)?.score ?? null,
                    pattern_recognition: (skills['pattern-recognition'] as any)?.score ?? null,
                    algorithmic_thinking: (skills['algorithmic-thinking'] as any)?.score ?? null,
                    complexity_analysis: (skills['complexity-analysis'] as any)?.score ?? null,
                    communication_clarity: (skills['communication-clarity'] as any)?.score ?? null,
                    edge_case_awareness: (skills['edge-case-awareness'] as any)?.score ?? null,
                    optimization_mindset: (skills['optimization-mindset'] as any)?.score ?? null,
                    debugging_approach: (skills['debugging-approach'] as any)?.score ?? null,
                    model_used: finalResult.modelUsed ?? 'unknown',
                    confidence: 0.8,
                    validation_pass_done: finalResult.validationPassDone ?? false,
                    code_quality: finalResult.codeQuality ?? null,
                    sub_criteria: Object.fromEntries(
                        Object.entries(skills).map(([k, v]) => [k, (v as any).subCriteria || {}])
                    )
                });

            if (assessmentError) {
                console.error('⚠️ [ACTION] Failed to save assessment object (partial success):', assessmentError);
                assessmentPending = true;

                const feedbackWithPending = {
                    ...(typeof finalResult === 'object' && finalResult
                        ? (finalResult as unknown as Record<string, unknown>)
                        : {}),
                    assessmentPending: true,
                    assessmentWriteFailed: true,
                    assessmentRetryRequired: true,
                    assessmentWriteError: assessmentError.message,
                };

                try {
                    const interviewSessionsQuery = supabase.from('interview_sessions') as any;

                    if (typeof interviewSessionsQuery?.update === 'function') {
                        const { error: pendingStatusError } = await interviewSessionsQuery
                            .update({
                                status: 'pending',
                                feedback: feedbackWithPending,
                            })
                            .eq('id', sessionData.id)
                            .eq('user_id', userId);

                        if (pendingStatusError) {
                            console.error('⚠️ [ACTION] Failed to set interview session pending state:', pendingStatusError);
                        }
                    } else {
                        console.error('⚠️ [ACTION] interview_sessions pending-state update unavailable on query builder');
                    }
                } catch (pendingUpdateErr) {
                    console.error('⚠️ [ACTION] Failed to apply pending-state fallback update:', pendingUpdateErr);
                }
            }

            // Hire readiness trend tracking
            if (hireDecision) {
                try {
                    const { data: diffData } = await supabase
                        .from('problems')
                        .select('difficulty')
                        .eq('id', problemId)
                        .maybeSingle();

                    const newEntry = {
                        sessionId: sessionData.id,
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
                session_id: sessionData.id,
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
                sessionId: sessionData.id,
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
                    sessionId: sessionData.id,
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
                    sessionId: sessionData.id,
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

        if (assessmentPending) {
            return { success: true, sessionId: sessionData.id, assessmentPending: true };
        }

        return { success: true, sessionId: sessionData.id };
    } catch (e) {
        const error = e as unknown;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [ACTION] Unexpected error in saveInterviewSession:', error);
        void logSystemEvent({ type: 'db_error', errorMessage, metadata: { operation: 'save_session' } });
        return { success: false, error: errorMessage, status: 500 };
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
