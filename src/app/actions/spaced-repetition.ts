'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { addToQueue } from '@/lib/spaced-repetition/queue';
import { formatNextReviewDate } from '@/lib/spaced-repetition/sm2';

// ─── 1. Upsert SM2 record after interview ──────────────────────────────────

export async function upsertSpacedRepetition(params: {
    userId: string;
    problemId: string;
    problemTitle?: string;
    problemDifficulty?: 'easy' | 'medium' | 'hard';
    overallScore: number;
}): Promise<{ nextReview: string; intervalDays: number; repetitions: number } | null> {
    try {
        // addToQueue handles fetch-existing → computeNextReview → upsert
        await addToQueue({
            userId: params.userId,
            problemId: params.problemId,
            problemTitle: params.problemTitle || 'Untitled',
            problemDifficulty: params.problemDifficulty || 'medium',
            overallScore: params.overallScore,
        });

        // Read back the record to return computed values
        const supabase = getServiceClient();
        const { data } = await supabase
            .from('spaced_repetition')
            .select('next_review_date, interval_days, repetitions')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (!data) return null;

        return {
            nextReview: data.next_review_date,
            intervalDays: data.interval_days,
            repetitions: data.repetitions,
        };
    } catch (error) {
        console.error('[upsertSpacedRepetition] Error:', error);
        return null;
    }
}

// ─── 2. Get review queue (due within next day) ─────────────────────────────

export async function getReviewQueue(userId: string): Promise<{
    problemId: string;
    problemTitle: string;
    difficulty: string;
    nextReview: string;
    repetitions: number;
    lastQuality: number | null;
}[]> {
    try {
        const supabase = getServiceClient();
        const tomorrow = formatNextReviewDate(1);

        const { data, error } = await supabase
            .from('spaced_repetition')
            .select('problem_id, problem_title, problem_difficulty, next_review_date, repetitions, last_quality')
            .eq('user_id', userId)
            .lte('next_review_date', tomorrow)
            .order('next_review_date', { ascending: true })
            .limit(10);

        if (error || !data) return [];

        return data.map((row: Record<string, unknown>) => ({
            problemId: row.problem_id as string,
            problemTitle: row.problem_title as string,
            difficulty: row.problem_difficulty as string,
            nextReview: row.next_review_date as string,
            repetitions: row.repetitions as number,
            lastQuality: row.last_quality as number | null,
        }));
    } catch (error) {
        console.error('[getReviewQueue] Error:', error);
        return [];
    }
}

// ─── 3. Get SM2 record for a specific problem ──────────────────────────────

export async function getSpacedRepForProblem(
    userId: string,
    problemId: string
): Promise<{
    intervalDays: number;
    nextReview: string;
    repetitions: number;
    easeFactor: number;
} | null> {
    try {
        const supabase = getServiceClient();

        const { data, error } = await supabase
            .from('spaced_repetition')
            .select('interval_days, next_review_date, repetitions, ease_factor')
            .eq('user_id', userId)
            .eq('problem_id', problemId)
            .maybeSingle();

        if (error || !data) return null;

        return {
            intervalDays: data.interval_days,
            nextReview: data.next_review_date,
            repetitions: data.repetitions,
            easeFactor: data.ease_factor,
        };
    } catch (error) {
        console.error('[getSpacedRepForProblem] Error:', error);
        return null;
    }
}
