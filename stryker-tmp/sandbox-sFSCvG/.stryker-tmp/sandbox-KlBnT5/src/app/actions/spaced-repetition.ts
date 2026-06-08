/**
 * @codesage
 * @file      src/app/actions/spaced-repetition.ts
 * @purpose   Server actions for managing user's spaced repetition queues and problem review schedules.
 * @tech      Next.js, Supabase, TypeScript
 * @connects  @/lib/supabase/server, @/lib/supabase/service, @/lib/spaced-repetition/queue
 * @apis      None
 * @db        Supabase 'spaced_repetition' table (select, upsert)
 * @state     None (Server Actions)
 * @env       Supabase connection envs implicitly
 * @issues    None found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use server';

import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { addToQueue } from '@/lib/spaced-repetition/queue';
import { formatNextReviewDate } from '@/lib/spaced-repetition/types';

// ─── 1. Upsert spaced-repetition record after interview ─────────────────────

export async function upsertSpacedRepetition(params: {
    userId: string;
    problemId: string;
    problemTitle?: string;
    problemDifficulty?: 'easy' | 'medium' | 'hard';
    overallScore: number;
}): Promise<{ nextReview: string; intervalDays: number; reviewCount: number } | null> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== params.userId) return null;

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
            .select('fsrs_due, fsrs_scheduled_days, fsrs_reps')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (!data) return null;

        return {
            nextReview: data.fsrs_due,
            intervalDays: data.fsrs_scheduled_days ?? 0,
            reviewCount: data.fsrs_reps ?? 0,
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
    reviewCount: number;
    lastQuality: number | null;
}[]> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== userId) return [];

        const supabase = getServiceClient();
        const tomorrow = formatNextReviewDate(1);

        const { data, error } = await supabase
            .from('spaced_repetition')
            .select('problem_id, problem_title, problem_difficulty, fsrs_due, fsrs_reps, last_quality')
            .eq('user_id', userId)
            .lte('fsrs_due', `${tomorrow}T23:59:59Z`)
            .order('fsrs_due', { ascending: true })
            .limit(10);

        if (error || !data) return [];

        return data.map((row: Record<string, unknown>) => ({
            problemId: row.problem_id as string,
            problemTitle: row.problem_title as string,
            difficulty: row.problem_difficulty as string,
            nextReview: row.fsrs_due as string,
            reviewCount: (row.fsrs_reps as number | null) ?? 0,
            lastQuality: row.last_quality as number | null,
        }));
    } catch (error) {
        console.error('[getReviewQueue] Error:', error);
        return [];
    }
}

// ─── 3. Get review schedule for a specific problem ──────────────────────────

export async function getSpacedReviewForProblem(
    userId: string,
    problemId: string
): Promise<{
    intervalDays: number;
    nextReview: string;
    reviewCount: number;
    fsrsDifficulty: number | null;
    fsrsStability: number | null;
    fsrsState: number | null;
    fsrsReps: number | null;
    fsrsLapses: number | null;
} | null> {
    try {
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (!user || user.id !== userId) return null;

        const supabase = getServiceClient();

        const { data, error } = await supabase
            .from('spaced_repetition')
            .select('interval, fsrs_scheduled_days, fsrs_due, fsrs_difficulty, fsrs_stability, fsrs_state, fsrs_reps, fsrs_lapses')
            .eq('user_id', userId)
            .eq('problem_id', problemId)
            .maybeSingle();

        if (error || !data) return null;

        return {
            intervalDays: data.fsrs_scheduled_days ?? data.interval ?? 0,
            nextReview: data.fsrs_due,
            reviewCount: data.fsrs_reps ?? 0,
            fsrsDifficulty: data.fsrs_difficulty ?? null,
            fsrsStability: data.fsrs_stability ?? null,
            fsrsState: data.fsrs_state ?? null,
            fsrsReps: data.fsrs_reps ?? null,
            fsrsLapses: data.fsrs_lapses ?? null,
        };
    } catch (error) {
        console.error('[getSpacedReviewForProblem] Error:', error);
        return null;
    }
}

// ─── 4. Add problem to review queue (auth-aware, for client components) ────

export async function addProblemToReviewQueue(params: {
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    overallScore: number;
}): Promise<{ nextReview: string; intervalDays: number; reviewCount: number } | null> {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        return await upsertSpacedRepetition({
            userId: user.id,
            ...params,
        });
    } catch (error) {
        console.error('[addProblemToReviewQueue] Error:', error);
        return null;
    }
}
