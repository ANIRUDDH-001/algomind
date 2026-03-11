/**
 * Shared types and utilities for spaced repetition.
 * Migrated from sm2.ts during SM-2 algorithm removal.
 * The SM-2 algorithm (computeNextReview) has been removed.
 * All scheduling now uses FSRS-5 (see fsrs.ts).
 */

export interface SpacedRepetitionRecord {
    problemId: string;
    problemTitle: string;
    problemDifficulty: 'easy' | 'medium' | 'hard';
    intervalDays: number;
    easeFactor: number;        // Kept for display of pre-FSRS records in AnalysisClient
    repetitions: number;
    lastQuality: number | null;
    nextReviewDate: string;
    lastReviewedAt: string | null;
}

/**
 * Returns a date string N days from now in YYYY-MM-DD format.
 * Used for building review queue display labels.
 */
export function formatNextReviewDate(intervalDays: number): string {
    return new Date(Date.now() + intervalDays * 86400000).toISOString().split('T')[0];
}
