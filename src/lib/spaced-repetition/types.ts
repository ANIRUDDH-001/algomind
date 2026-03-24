/**
 * Shared types and utilities for spaced repetition.
 * Legacy algorithm code was removed.
 * All scheduling now uses FSRS-5 (see fsrs.ts).
 */

export interface SpacedRepetitionRecord {
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    intervalDays: number;
    fsrsReps: number;
    lastQuality: number | null;
    fsrsDueDate: string;
    lastReviewedAt: string | null;
}

/**
 * Returns a date string N days from now in YYYY-MM-DD format.
 * Used for building review queue display labels.
 */
export function formatNextReviewDate(intervalDays: number): string {
    return new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0];
}
