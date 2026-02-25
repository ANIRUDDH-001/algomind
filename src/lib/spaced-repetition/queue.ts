import { getSupabase } from '@/lib/supabase/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import { SpacedRepetitionRecord, computeNextReview } from './sm2';
import { getServiceClient } from '@/lib/supabase/service';

export async function addToQueue(params: {
    userId: string;
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    overallScore: number;
}): Promise<void> {
    try {
        const supabase = getServiceClient();

        // Check if problem already exists in queue
        const { data: existing, error: fetchError } = await supabase
            .from('spaced_repetition')
            .select('interval, ease_factor, repetitions')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (fetchError) {
            throw fetchError;
        }

        let upsertData: any;

        if (existing) {
            const nextSchedule = computeNextReview({
                intervalDays: existing.interval,
                easeFactor: existing.ease_factor,
                repetitions: existing.repetitions,
            }, params.overallScore);

            const reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + nextSchedule.intervalDays);

            upsertData = {
                user_id: params.userId,
                problem_id: params.problemId,
                interval: nextSchedule.intervalDays,
                ease_factor: nextSchedule.easeFactor,
                repetitions: nextSchedule.repetitions,
                next_review: reviewDate.toISOString(),
                last_reviewed: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        } else {
            // New entry: run through SM-2 from a blank-slate record so first-time
            // scheduling is score-aware (high scores → longer initial interval).
            // computeNextReview converts overallScore (0-10) → SM-2 quality (0-5) internally.
            const initialRecord = { intervalDays: 1, easeFactor: 2.5, repetitions: 0 };
            const nextSchedule = computeNextReview(initialRecord, params.overallScore);

            const reviewDate = new Date();
            reviewDate.setDate(reviewDate.getDate() + nextSchedule.intervalDays);

            upsertData = {
                user_id: params.userId,
                problem_id: params.problemId,
                interval: nextSchedule.intervalDays,
                ease_factor: nextSchedule.easeFactor,
                repetitions: nextSchedule.repetitions,
                next_review: reviewDate.toISOString(),
                last_reviewed: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        }

        const { error: upsertError } = await supabase
            .from('spaced_repetition')
            .upsert(upsertData, { onConflict: 'user_id,problem_id' });

        if (upsertError) {
            throw upsertError;
        }
    } catch (error: any) {
        void logSystemEvent({
            type: 'db_error',
            errorMessage: error.message || 'Failed to addToQueue',
            metadata: { operation: 'addToQueue', problemId: params.problemId }
        });
    }
}

export async function getDueReviews(userId: string): Promise<SpacedRepetitionRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    // Calls get_due_reviews RPC
    const { data, error } = await supabase.rpc('get_due_reviews', { user_id: userId });

    if (error || !data) {
        return [];
    }

    return (data as any[]).map(row => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.interval,
        easeFactor: row.ease_factor,
        repetitions: row.repetitions,
        lastQuality: row.last_quality,
        nextReviewDate: row.next_review,
        lastReviewedAt: row.last_reviewed
    }));
}

export async function getUpcomingReviews(userId: string, days: number = 7): Promise<SpacedRepetitionRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + days);

    const { data, error } = await supabase
        .from('spaced_repetition')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review', maxDate.toISOString())
        .order('next_review', { ascending: true });

    if (error || !data) {
        return [];
    }

    return data.map((row: any) => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.interval,
        easeFactor: row.ease_factor,
        repetitions: row.repetitions,
        lastQuality: row.last_quality,
        nextReviewDate: row.next_review,
        lastReviewedAt: row.last_reviewed
    }));
}
