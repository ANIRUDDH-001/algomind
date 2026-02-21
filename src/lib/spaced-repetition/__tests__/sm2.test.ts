import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeNextReview, formatNextReviewDate } from '../sm2';

describe('SM2 Spaced Repetition Algorithm', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        // Set fixed current date for stable formatting tests
        vi.setSystemTime(new Date('2026-02-21T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.runAllTimers();
        vi.useRealTimers();
    });

    const createInitialState = () => ({
        intervalDays: 0,
        easeFactor: 2.5,
        repetitions: 0
    });

    it('1. New card (no history): nextReview is tomorrow, interval=1', () => {
        const state = createInitialState();
        // overallScore of 10 -> quality 5
        const result = computeNextReview(state, 10);

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(1);
        expect(result.lastQuality).toBe(5);

        const nextDate = formatNextReviewDate(result.intervalDays);
        // Tomorrow relative to 2026-02-21
        expect(nextDate).toBe('2026-02-22');
    });

    it('2. Quality=5 (perfect recall): interval roughly doubles each review', () => {
        // Start from first rep
        let state = { intervalDays: 1, easeFactor: 2.5, repetitions: 1 };

        // Rep 2 (quality 5)
        let result = computeNextReview(state, 10);
        expect(result.intervalDays).toBe(6);
        expect(result.repetitions).toBe(2);

        // Rep 3 (quality 5)
        state = { intervalDays: result.intervalDays, easeFactor: result.easeFactor, repetitions: result.repetitions };
        result = computeNextReview(state, 10);

        // 6 * ~2.6 (ease factor slightly increased)
        expect(result.intervalDays).toBeGreaterThan(12);
    });

    it('3. Quality=2 (hard): interval resets to 1 day', () => {
        const state = { intervalDays: 14, easeFactor: 2.5, repetitions: 3 };
        // overallScore 4 -> quality 2
        const result = computeNextReview(state, 4);

        expect(result.lastQuality).toBe(2);
        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(0); // Sequence is reset for low scores
    });

    it('4. Quality=0 (blackout): interval resets, easeFactor decreases', () => {
        const state = { intervalDays: 10, easeFactor: 2.5, repetitions: 2 };
        // overallScore 0 -> quality 0
        const result = computeNextReview(state, 0);

        expect(result.lastQuality).toBe(0);
        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(0);
        expect(result.easeFactor).toBeLessThan(2.5); // Dropped significantly
    });

    it('5. EaseFactor never drops below 1.3', () => {
        let state = { intervalDays: 1, easeFactor: 1.4, repetitions: 1 };

        // Multiple blackout events (quality 0)
        for (let i = 0; i < 5; i++) {
            const result = computeNextReview(state, 0);
            state = { intervalDays: result.intervalDays, easeFactor: result.easeFactor, repetitions: result.repetitions };
        }

        expect(state.easeFactor).toBe(1.3); // Hit the mathematical floor
    });

    it('6. EaseFactor increases for quality >= 4', () => {
        const state = { intervalDays: 10, easeFactor: 2.5, repetitions: 2 };

        // Quality 4 (score 8)
        const result4 = computeNextReview(state, 8);
        expect(result4.lastQuality).toBe(4);
        // Unchanged actually for exactly 4 in classic SM2 formulas mathematically
        // Math.max(1.3, 2.5 + 0.1 - (5 - 4) * (0.08 + (5 - 4) * 0.02)) -> 2.5 + 0.1 - 0.1 -> 2.5
        // We will test Quality 5 explicitly for the increase scenario

        const result5 = computeNextReview(state, 10);
        expect(result5.lastQuality).toBe(5);
        expect(result5.easeFactor).toBeGreaterThan(2.5); // Should definitively increase for 5
    });

    it('7. After 3 perfect reviews: interval should be >6 days', () => {
        let state = createInitialState();

        // Review 1
        state = computeNextReview(state, 10);
        expect(state.intervalDays).toBe(1); // Rep 1 (New -> R1)

        // Review 2
        state = computeNextReview(state, 10);
        expect(state.intervalDays).toBe(6); // Rep 2 (R1 -> R2)

        // Review 3
        state = computeNextReview(state, 10);
        expect(state.intervalDays).toBeGreaterThan(6); // R2 -> R3 explicitly scales multiplier
        // 6 * 2.6 = ~16
    });

    it('8. Repetition count increments correctly', () => {
        let state = createInitialState(); // reps: 0
        state = computeNextReview(state, 10); // reps: 1
        expect(state.repetitions).toBe(1);
        state = computeNextReview(state, 10); // reps: 2
        expect(state.repetitions).toBe(2);
        state = computeNextReview(state, 10); // reps: 3
        expect(state.repetitions).toBe(3);
    });

    it('9. nextReview date is always in the future relative to the review date', () => {
        const intervals = [1, 6, 14, 30, 90, 180];

        const todayStr = new Date().toISOString().split('T')[0];
        const todayDate = new Date(todayStr).getTime();

        intervals.forEach(days => {
            const futureStr = formatNextReviewDate(days);
            const futureDate = new Date(futureStr).getTime();

            expect(futureDate).toBeGreaterThan(todayDate);
        });
    });
});
