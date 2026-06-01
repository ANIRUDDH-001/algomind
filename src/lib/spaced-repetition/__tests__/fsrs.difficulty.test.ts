/**
 * @codesage
 * @file      src/lib/spaced-repetition/__tests__/fsrs.difficulty.test.ts
 * @purpose   Tests for Spaced repetition algorithms (FSRS, SM2) and scheduling queues.
 * @tech      Node.js, ts-fsrs
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { scoreToFSRSRating, computeNextReviewFSRS, createNewFSRSCardData } from '../fsrs';
import { Rating } from 'ts-fsrs';

describe('FSRS Difficulty and Scoring', () => {
    it('converts raw scores to FSRS ratings correctly', () => {
        expect(scoreToFSRSRating(3)).toBe(Rating.Again);
        expect(scoreToFSRSRating(5)).toBe(Rating.Hard);
        expect(scoreToFSRSRating(7)).toBe(Rating.Good);
        expect(scoreToFSRSRating(9)).toBe(Rating.Easy);
    });

    it('computes due date properly for new cards', () => {
        const initial = createNewFSRSCardData();
        const next = computeNextReviewFSRS(initial, 7); // Good score
        expect(next.intervalDays).toBeGreaterThanOrEqual(0);
        expect(next.fsrs_reps).toBe(1);
    });
});
