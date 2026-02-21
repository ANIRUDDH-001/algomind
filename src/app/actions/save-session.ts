'use server';

import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { ConversationTurn } from '@/lib/assessment/prompts';
import { logSystemEvent } from '@/lib/monitoring/events';
import { updateKaiMemory } from '@/lib/ai/memory-generator';

export async function saveInterviewSession(
    userId: string,
    problemId: string,
    problemTitle: string,
    transcript: ConversationTurn[],
    durationSeconds: number,
    result: AssessmentResult
) {

    const supabase = await createClient();

    try {
        // Profile creation is handled by the handle_new_user trigger.
        // If trigger failed, the session insert will surface the actual FK error.
        await supabase.rpc('ensure_learner_profile', { p_user_id: userId });

        const { data: sessionData, error } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: userId,
                problem_id: problemId,
                problem_title: problemTitle,
                transcript: transcript,
                duration: durationSeconds,
                feedback: result,
                overall_score: Object.values(result.skills).reduce((acc, s) => acc + s.score, 0) / Object.keys(result.skills).length,
                created_at: new Date().toISOString()
            })
            .select() // Select to return the inserted row
            .single();

        if (error) {
            console.error('❌ [ACTION] Failed to save session:', error);
            void logSystemEvent({ type: 'db_error', errorMessage: error.message, metadata: { operation: 'save_session' } });
            return { success: false, error: error.message };
        }

        // Save knowledge gaps if any
        if (result.knowledgeGaps && result.knowledgeGaps.length > 0) {


            // Map gaps to table structure
            // We use the new session ID we just got
            const gapsToInsert = result.knowledgeGaps.map(gap => ({
                user_query: gap, // Using the gap text as the 'query' for now
                gap_reason: 'Identified during AI assessment',
                session_id: sessionData.id,
                user_id: userId,
                status: 'new',       // 'new' as per schema implies pending review
                priority: 'medium',
                upvotes: 1
            }));

            const { error: gapError } = await supabase
                .from('knowledge_gaps')
                .insert(gapsToInsert);

            if (gapError) {
                console.error('⚠️ [ACTION] Failed to save knowledge gaps:', gapError);
                // We don't fail the whole request because the primary session was saved
            }
        }

        void updateKaiMemory(userId);

        return { success: true };
    } catch (e) {
        const error = e as unknown;
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ [ACTION] Unexpected error:', error);
        void logSystemEvent({ type: 'db_error', errorMessage, metadata: { operation: 'save_session' } });
        return { success: false, error: errorMessage };
    }
}
