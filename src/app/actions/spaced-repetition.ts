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
            .select('next_review, interval, repetitions, fsrs_due, fsrs_scheduled_days, use_fsrs')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (!data) return null;

        return {
            nextReview: data.use_fsrs ? data.fsrs_due : data.next_review,
            intervalDays: data.use_fsrs ? data.fsrs_scheduled_days : data.interval,
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
            .select('problem_id, problem_title, problem_difficulty, next_review, repetitions, last_quality, fsrs_due, use_fsrs')
            .eq('user_id', userId)
            .or(`and(use_fsrs.eq.true,fsrs_due.lte.${tomorrow}T23:59:59Z),and(use_fsrs.eq.false,next_review.lte.${tomorrow}),and(use_fsrs.is.null,next_review.lte.${tomorrow})`)
            .order('fsrs_due', { ascending: true })
            .limit(10);

        if (error || !data) return [];

        return data.map((row: Record<string, unknown>) => ({
            problemId: row.problem_id as string,
            problemTitle: row.problem_title as string,
            difficulty: row.problem_difficulty as string,
            nextReview: (row.use_fsrs ? row.fsrs_due : row.next_review) as string,
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
            .select('interval, next_review, repetitions, ease_factor, use_fsrs, fsrs_scheduled_days, fsrs_due')
            .eq('user_id', userId)
            .eq('problem_id', problemId)
            .maybeSingle();

        if (error || !data) return null;

        return {
            intervalDays: data.use_fsrs ? data.fsrs_scheduled_days : data.interval,
            nextReview: data.use_fsrs ? data.fsrs_due : data.next_review,
            repetitions: data.repetitions,
            easeFactor: data.ease_factor,
        };
    } catch (error) {
        console.error('[getSpacedRepForProblem] Error:', error);
        return null;
    }
}
