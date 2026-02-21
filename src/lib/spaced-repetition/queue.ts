import { getSupabase } from '@/lib/supabase/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import { SpacedRepetitionRecord, computeNextReview, formatNextReviewDate } from './sm2';
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
            .select('interval_days, ease_factor, repetitions, last_quality')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (fetchError) {
            throw fetchError;
        }

        let upsertData: any = {
            user_id: params.userId,
            problem_id: params.problemId,
            problem_title: params.problemTitle,
            problem_difficulty: params.problemDifficulty,
            last_reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (existing) {
            const nextSchedule = computeNextReview({
                intervalDays: existing.interval_days,
                easeFactor: existing.ease_factor,
                repetitions: existing.repetitions,
            }, params.overallScore);

            upsertData = {
                ...upsertData,
                interval_days: nextSchedule.intervalDays,
                ease_factor: nextSchedule.easeFactor,
                repetitions: nextSchedule.repetitions,
                last_quality: nextSchedule.lastQuality,
                next_review_date: formatNextReviewDate(nextSchedule.intervalDays),
            };
        } else {
            // New entry: run through SM-2 from a blank-slate record so first-time
            // scheduling is score-aware (high scores → longer initial interval).
            // computeNextReview converts overallScore (0-10) → SM-2 quality (0-5) internally.
            const initialRecord = { intervalDays: 1, easeFactor: 2.5, repetitions: 0 };
            const nextSchedule = computeNextReview(initialRecord, params.overallScore);

            upsertData = {
                ...upsertData,
                interval_days: nextSchedule.intervalDays,
                ease_factor: nextSchedule.easeFactor,
                repetitions: nextSchedule.repetitions,
                last_quality: nextSchedule.lastQuality,
                next_review_date: formatNextReviewDate(nextSchedule.intervalDays),
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
    // Assuming the RPC signature accepts "user_id" or "p_user_id"
    // Using user_id as it conforms to standard naming
    const { data, error } = await supabase.rpc('get_due_reviews', { user_id: userId });

    if (error || !data) {
        return [];
    }

    return (data as any[]).map(row => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.interval_days,
        easeFactor: row.ease_factor,
        repetitions: row.repetitions,
        lastQuality: row.last_quality,
        nextReviewDate: row.next_review_date,
        lastReviewedAt: row.last_reviewed_at
    }));
}

export async function getUpcomingReviews(userId: string, days: number = 7): Promise<SpacedRepetitionRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const maxDate = formatNextReviewDate(days);

    const { data, error } = await supabase
        .from('spaced_repetition')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', maxDate)
        .order('next_review_date', { ascending: true });

    if (error || !data) {
        return [];
    }

    return data.map((row: any) => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.interval_days,
        easeFactor: row.ease_factor,
        repetitions: row.repetitions,
        lastQuality: row.last_quality,
        nextReviewDate: row.next_review_date,
        lastReviewedAt: row.last_reviewed_at
    }));
}
