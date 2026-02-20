'use server';

import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { ConversationTurn } from '@/lib/assessment/prompts';

export async function saveInterviewSession(
    userId: string,
    problemId: string,
    problemTitle: string,
    transcript: ConversationTurn[],
    durationSeconds: number,
    result: AssessmentResult
) {
    console.log('💾 [ACTION] Saving interview session...');
    const supabase = await createClient();

    try {
        // Defensive profile upsert to prevent FK constraint failures
        // This is needed if the handle_new_user trigger wasn't deployed correctly
        await supabase
            .from('profiles')
            .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true });

        const { data: sessionData, error } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: userId,
                problem_id: problemId,
                problem_title: problemTitle,
                transcript: transcript,
                duration: durationSeconds,
                duration_seconds: durationSeconds,
                feedback: result,
                overall_score: Object.values(result.skills).reduce((acc, s) => acc + s.score, 0) / Object.keys(result.skills).length,
                created_at: new Date().toISOString()
            })
            .select() // Select to return the inserted row
            .single();

        if (error) {
            console.error('❌ [ACTION] Failed to save session:', error);
            return { success: false, error: error.message };
        }

        // Save knowledge gaps if any
        if (result.knowledgeGaps && result.knowledgeGaps.length > 0) {
            console.log(`🧠 [ACTION] Saving ${result.knowledgeGaps.length} knowledge gaps...`);

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

        console.log('✅ [ACTION] Session saved successfully');
        return { success: true };
    } catch (e) {
        const error = e as unknown;
        console.error('❌ [ACTION] Unexpected error:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
