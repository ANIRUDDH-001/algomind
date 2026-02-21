import { describe, it, expect } from 'vitest';
import { computeNextReview, formatNextReviewDate } from '../sm2';

describe('SM-2 Spaced Repetition Algorithm', () => {
    it('First attempt, score 3/10 -> interval should be 1, repetitions should be 0', () => {
        // 3/10 -> quality = Math.round((3/10)*5) = 2. 2 < 3 -> interval 1, repetitions 0
        const current = { intervalDays: 1, easeFactor: 2.5, repetitions: 0 };
        const result = computeNextReview(current, 3);

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(0);
        expect(result.lastQuality).toBe(2);
    });

    it('First attempt, score 8/10 -> interval should be 1, repetitions should be 1', () => {
        // 8/10 -> quality = Math.round((8/10)*5) = 4. 4 >= 3 -> repetitions === 0 -> interval 1, repetitions 1
        const current = { intervalDays: 1, easeFactor: 2.5, repetitions: 0 };
        const result = computeNextReview(current, 8);

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(1);
        expect(result.lastQuality).toBe(4);
        expect(result.easeFactor).toBe(2.5);
    });

    it('Second attempt, score 8/10 -> interval should be 6, repetitions should be 2', () => {
        const current = { intervalDays: 1, easeFactor: 2.5, repetitions: 1 };
        const result = computeNextReview(current, 8);

        expect(result.intervalDays).toBe(6);
        expect(result.repetitions).toBe(2);
        expect(result.lastQuality).toBe(4);
        // easeFactor computation: 2.5 + 0.1 - (5-4)*(0.08 + (5-4)*0.02) = 2.6 - 0.1 = 2.5
        expect(result.easeFactor).toBe(2.5);
    });

    it('Third attempt, score 8/10 -> interval approx 15, repetitions 3', () => {
        const current = { intervalDays: 6, easeFactor: 2.5, repetitions: 2 };
        const result = computeNextReview(current, 8);

        expect(result.intervalDays).toBe(15); // Math.round(6 * 2.5) = 15
        expect(result.repetitions).toBe(3);
        expect(result.lastQuality).toBe(4);
        expect(result.easeFactor).toBe(2.5);
    });

    it('Failed attempt (score 2/10), repetitions resets to 0, interval 1', () => {
        // 2/10 -> quality = Math.round((2/10)*5) = 1
        const current = { intervalDays: 15, easeFactor: 2.5, repetitions: 3 };
        const result = computeNextReview(current, 2);

        expect(result.intervalDays).toBe(1);
        expect(result.repetitions).toBe(0);
        expect(result.lastQuality).toBe(1);
    });

    it('Cap interval at 180 days', () => {
        const current = { intervalDays: 100, easeFactor: 2.5, repetitions: 5 };
        const result = computeNextReview(current, 10);

        expect(result.intervalDays).toBe(180);
        expect(result.repetitions).toBe(6);
    });

    it('formatNextReviewDate returns ISO date string YYYY-MM-DD', () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // Need to ignore time part for precise mock? 
        // It's tested against real time, so Date.now() is variable.
        // Just verify the format:
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        expect(regex.test(formatNextReviewDate(1))).toBe(true);
    });
});
