'use server';

import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { ConversationTurn } from '@/lib/assessment/prompts';
import { logSystemEvent } from '@/lib/monitoring/events';
import { updateKaiMemory } from '@/lib/ai/memory-generator';
import { addToQueue } from '@/lib/spaced-repetition/queue';

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
                    crypto.randomUUID(),
                    { title: problemTitle, description: prob?.description || '', difficulty: prob?.difficulty || 'medium' },
                    transcript
                );
            } catch (err) {
                console.error('⚠️ [ACTION] AI Assessment failed, saving session without full assessment:', err);
                // Fallback result for Requirement 4
                finalResult = {
                    sessionId: 'failed-analysis',
                    timestamp: new Date(),
                    problem: { title: problemTitle, description: '', difficulty: 'medium' },
                    skills: {},
                    overallFeedback: 'AI analysis failed during save.',
                    nextSteps: [],
                    knowledgeGaps: []
                } as unknown as AssessmentResult;
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

        // 4. Save assessment details (Requirement 6)
        if (finalResult) {
            // Map skill keys (hyphenated) to DB columns (underscored)
            const skills = finalResult.skills || {};
            const { error: assessmentError } = await supabase
                .from('assessments')
                .insert({
                    session_id: sessionData.id,
                    user_id: userId,
                    overall_score: overallScore,
                    overall_feedback: finalResult.overallFeedback,
                    next_steps: finalResult.nextSteps,
                    skill_evidence: finalResult.skills,
                    // ✅ FIX: Individual skill score columns
                    problem_decomposition: (skills['problem-decomposition'] as any)?.score ?? null,
                    pattern_recognition: (skills['pattern-recognition'] as any)?.score ?? null,
                    algorithmic_thinking: (skills['algorithmic-thinking'] as any)?.score ?? null,
                    complexity_analysis: (skills['complexity-analysis'] as any)?.score ?? null,
                    communication_clarity: (skills['communication-clarity'] as any)?.score ?? null,
                    edge_case_awareness: (skills['edge-case-awareness'] as any)?.score ?? null,
                    optimization_mindset: (skills['optimization-mindset'] as any)?.score ?? null,
                    debugging_approach: (skills['debugging-approach'] as any)?.score ?? null,
                    model_used: 'gemini-2.0-flash',
                    confidence: 0.8,
                });

            if (assessmentError) {
                console.error('⚠️ [ACTION] Failed to save assessment object (partial success):', assessmentError);
                // Requirement 6: We return success: true because the session itself is saved
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
        try {
            await updateKaiMemory(userId);
        } catch (err) { console.error('[save-session] Memory update failed:', err); }

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
                overallScore: overallScore
            });
        } catch (err) { console.error('[save-session] addToQueue failed:', err); }

        try {
            const { invalidateDashboardCache } = await import('@/lib/cache/dashboardCache');
            await invalidateDashboardCache(userId);
        } catch (err) { console.error('[save-session] Cache invalidation failed:', err); }

        return { success: true, sessionId: sessionData.id };
    } catch (e) {
        const error = e as unknown;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [ACTION] Unexpected error in saveInterviewSession:', error);
        void logSystemEvent({ type: 'db_error', errorMessage, metadata: { operation: 'save_session' } });
        return { success: false, error: errorMessage, status: 500 };
    }
}
