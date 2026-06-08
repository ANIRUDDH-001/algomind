/**
 * @codesage
 * @file      src/lib/spaced-repetition/queue.ts
 * @purpose   Spaced repetition algorithms (FSRS, SM2) and scheduling queues.
 * @tech      Node.js, ts-fsrs
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { getSupabase } from '@/lib/supabase/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import { SpacedRepetitionRecord } from './types';
import { computeNextReviewFSRS, createNewFSRSCardData } from './fsrs';
import { getServiceClient } from '@/lib/supabase/service';

export async function addToQueue(params: {
    userId: string;
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    overallScore: number;
    sessionStatus?: string;
}): Promise<void> {
    // Guard: skip FSRS card update for incomplete sessions (BUG-06)
    if (params.sessionStatus === 'incomplete') {
        console.warn(`[FSRS] Skipping card update for incomplete session (problem: ${params.problemId}, user: ${params.userId})`);
        return;
    }

    try {
        const supabase = getServiceClient();

        // Check if problem already exists in queue
        const { data: existing, error: fetchError } = await supabase
            .from('spaced_repetition')
            .select('*')
            .eq('user_id', params.userId)
            .eq('problem_id', params.problemId)
            .maybeSingle();

        if (fetchError) {
            throw fetchError;
        }

        let upsertData: any;

        if (existing) {
            const result = computeNextReviewFSRS(existing, params.overallScore);

            upsertData = {
                user_id: params.userId,
                problem_id: params.problemId,
                // FSRS fields
                fsrs_stability: result.fsrs_stability,
                fsrs_difficulty: result.fsrs_difficulty,
                fsrs_elapsed_days: result.fsrs_elapsed_days,
                fsrs_scheduled_days: result.fsrs_scheduled_days,
                fsrs_reps: result.fsrs_reps,
                fsrs_lapses: result.fsrs_lapses,
                fsrs_state: result.fsrs_state,
                fsrs_last_review: result.fsrs_last_review,
                fsrs_due: result.fsrs_due,
                interval: result.intervalDays,
                last_reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_quality: result.lastQuality,
            };
        } else {
            // New entry: start clean FSRS record
            const initialRecord = createNewFSRSCardData();
            const result = computeNextReviewFSRS(initialRecord, params.overallScore);

            upsertData = {
                user_id: params.userId,
                problem_id: params.problemId,
                problem_title: params.problemTitle,
                problem_difficulty: params.problemDifficulty,
                // FSRS fields
                fsrs_stability: result.fsrs_stability,
                fsrs_difficulty: result.fsrs_difficulty,
                fsrs_elapsed_days: result.fsrs_elapsed_days,
                fsrs_scheduled_days: result.fsrs_scheduled_days,
                fsrs_reps: result.fsrs_reps,
                fsrs_lapses: result.fsrs_lapses,
                fsrs_state: result.fsrs_state,
                fsrs_last_review: result.fsrs_last_review,
                fsrs_due: result.fsrs_due,
                interval: result.intervalDays,
                last_reviewed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_quality: result.lastQuality,
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

export async function updateSkillRepetition(params: {
    userId: string;
    sessionId: string;
    dimensionScores: Record<string, number>;  // 8 skill_id → score
}): Promise<void> {
    const supabase = getServiceClient();

    for (const [skillId, score] of Object.entries(params.dimensionScores)) {
        try {
            // Fetch existing skill record
            const { data: existing } = await supabase
                .from('skill_repetition')
                .select('*')
                .eq('user_id', params.userId)
                .eq('skill_id', skillId)
                .maybeSingle();

            const record = existing ?? createNewFSRSCardData();
            const nextCard = computeNextReviewFSRS(record, score);

            await supabase
                .from('skill_repetition')
                .upsert({
                    user_id: params.userId,
                    skill_id: skillId,
                    fsrs_stability: nextCard.fsrs_stability,
                    fsrs_difficulty: nextCard.fsrs_difficulty,
                    fsrs_elapsed_days: nextCard.fsrs_elapsed_days,
                    fsrs_scheduled_days: nextCard.fsrs_scheduled_days,
                    fsrs_reps: nextCard.fsrs_reps,
                    fsrs_lapses: nextCard.fsrs_lapses,
                    fsrs_state: nextCard.fsrs_state,
                    fsrs_last_review: nextCard.fsrs_last_review,
                    fsrs_due: nextCard.fsrs_due,
                    last_score: score,
                    last_session_id: params.sessionId,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,skill_id',
                });
        } catch (error: any) {
            void logSystemEvent({
                type: 'db_error',
                errorMessage: error.message || 'Failed to update skill repetition',
                metadata: { operation: 'updateSkillRepetition', skillId, userId: params.userId }
            });
        }
    }
}

export async function getDueReviews(userId: string): Promise<SpacedRepetitionRecord[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from('spaced_repetition')
        .select('*')
        .eq('user_id', userId)
        .lte('fsrs_due', now)
        .order('fsrs_due', { ascending: true });

    if (error || !data) {
        return [];
    }

    return (data as any[]).map(row => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.fsrs_scheduled_days ?? row.interval ?? 0,
        fsrsReps: row.fsrs_reps ?? 0,
        lastQuality: row.last_quality,
        fsrsDueDate: row.fsrs_due,
        lastReviewedAt: row.fsrs_last_review ?? row.last_reviewed_at ?? null,
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
        .lte('fsrs_due', maxDate.toISOString())
        .order('fsrs_due', { ascending: true });

    if (error || !data) {
        return [];
    }

    return data.map((row: any) => ({
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        problemDifficulty: row.problem_difficulty,
        intervalDays: row.fsrs_scheduled_days ?? row.interval ?? 0,
        fsrsReps: row.fsrs_reps ?? 0,
        lastQuality: row.last_quality,
        fsrsDueDate: row.fsrs_due,
        lastReviewedAt: row.fsrs_last_review ?? row.last_reviewed_at ?? null,
    }));
}
