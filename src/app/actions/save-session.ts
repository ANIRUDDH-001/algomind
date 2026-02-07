import { createServerSupabase as createClient } from '@/lib/supabase/server';
import { AssessmentResult } from '@/lib/assessment/analyzer'; // Ensure this type exists or use 'any' if not exported

export async function saveInterviewSession(
    userId: string,
    problemId: string,
    problemTitle: string,
    transcript: any[],
    durationSeconds: number,
    result: AssessmentResult
) {
    console.log('💾 [ACTION] Saving interview session...');
    const supabase = await createClient();

    try {
        const { error } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: userId,
                problem_id: problemId,
                title: problemTitle,
                transcript: transcript,
                duration_seconds: durationSeconds,
                feedback: result,
                overall_score: Object.values(result.skills).reduce((acc, s) => acc + s.score, 0) / Object.keys(result.skills).length,
                created_at: new Date().toISOString()
            });

        if (error) {
            console.error('❌ [ACTION] Failed to save session:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ [ACTION] Session saved successfully');
        return { success: true };
    } catch (e: any) {
        console.error('❌ [ACTION] Unexpected error:', e);
        return { success: false, error: e.message };
    }
}
