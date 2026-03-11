import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatNextReviewDate, SpacedRepetitionRecord } from '../types';

// ── Verify SM-2 algorithm was removed ────────────────────────────────────────

describe('SM-2 Migration: computeNextReview removed', () => {
    it('computeNextReview is NOT exported from types.ts', async () => {
        // This test documents that the SM-2 algorithm has been intentionally removed.
        // All scheduling now uses FSRS-5 (see fsrs.ts and skill-scheduler.ts).
        const typesModule = await import('../types');
        expect((typesModule as any).computeNextReview).toBeUndefined();
    });

    it('computeNextReview is NOT exported from sm2.ts (deprecated)', async () => {
        const sm2Module = await import('../sm2');
        expect((sm2Module as any).computeNextReview).toBeUndefined();
    });
});

// ── Verify migrated utilities still work ─────────────────────────────────────

describe('formatNextReviewDate', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-21T00:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns a date string N days from now', () => {
        expect(formatNextReviewDate(1)).toBe('2026-02-22');
        expect(formatNextReviewDate(7)).toBe('2026-02-28');
        expect(formatNextReviewDate(0)).toBe('2026-02-21');
    });

    it('always returns a future date for positive intervals', () => {
        const result = formatNextReviewDate(30);
        const resultDate = new Date(result).getTime();
        expect(resultDate).toBeGreaterThan(Date.now());
    });

    it('caps are handled externally — formatNextReviewDate does not cap', () => {
        // The 180-day cap is enforced by FSRS, not the date formatter
        expect(formatNextReviewDate(365)).toBe('2027-02-21');
    });
});

// ── Verify SpacedRepetitionRecord type shape ──────────────────────────────────

describe('SpacedRepetitionRecord type', () => {
    it('can be constructed with all required fields', () => {
        const record: SpacedRepetitionRecord = {
            problemId: 'test-problem',
            problemTitle: 'Two Sum',
            problemDifficulty: 'easy',
            intervalDays: 6,
            easeFactor: 2.5,       // legacy field, kept for display of old records
            repetitions: 2,
            lastQuality: 4,
            nextReviewDate: '2026-03-01',
            lastReviewedAt: '2026-02-21',
        };
        expect(record.problemId).toBe('test-problem');
        expect(record.easeFactor).toBe(2.5); // still accessible for display purposes
    });
});
