/**
 * @codesage
 * @file      src/lib/spaced-repetition/types.ts
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
