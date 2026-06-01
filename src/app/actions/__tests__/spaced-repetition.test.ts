/**
 * @codesage
 * @file      src/app/actions/__tests__/spaced-repetition.test.ts
 * @purpose   Unit tests for spaced repetition server actions like upserting and queue fetching.
 * @tech      Vitest, Supabase, TypeScript
 * @connects  ../spaced-repetition, @/lib/spaced-repetition/queue, @/lib/supabase/service
 * @apis      None
 * @db        Mocked Supabase calls
 * @state     None
 * @env       None
 * @issues    None found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upsertSpacedRepetition, getReviewQueue, getSpacedReviewForProblem } from '../spaced-repetition';
import { addToQueue } from '@/lib/spaced-repetition/queue';
import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';
import { formatNextReviewDate } from '@/lib/spaced-repetition/types';

// Mock dependencies
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/spaced-repetition/queue', () => ({
    addToQueue: vi.fn(),
}));

vi.mock('@/lib/spaced-repetition/types', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/spaced-repetition/types')>();
    return {
        ...actual,
        formatNextReviewDate: vi.fn(actual.formatNextReviewDate), // Spy on it while keeping original behavior
    };
});

// Helper to mock Supabase chain
function mockSupabaseResponse(data: any, error: any = null) {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data, error });
    const limitMock = vi.fn().mockResolvedValue({ data, error });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const orMock = vi.fn().mockReturnValue({ order: orderMock });
    const lteMock = vi.fn().mockReturnValue({ order: orderMock });
    const eqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }), lte: lteMock, maybeSingle: maybeSingleMock, or: orMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const fromMock = vi.fn().mockReturnValue({ select: selectMock });

    return { from: fromMock };
}

describe('Spaced Repetition Server Actions', () => {
    const MockDate = new Date('2026-02-25T12:00:00Z');

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(MockDate);

        (createServerSupabase as any).mockResolvedValue({
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('upsertSpacedRepetition', () => {
        it('should call addToQueue and read back the new record', async () => {
            const mockDbData = {
                fsrs_due: '2026-02-26T00:00:00.000Z',
                fsrs_scheduled_days: 1,
                fsrs_reps: 1,
            };
            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(mockDbData));
            (addToQueue as any).mockResolvedValue(undefined);

            const result = await upsertSpacedRepetition({
                userId: 'user-1',
                problemId: 'prob-1',
                overallScore: 8,
            });

            expect(addToQueue).toHaveBeenCalledWith({
                userId: 'user-1',
                problemId: 'prob-1',
                problemTitle: 'Untitled',
                problemDifficulty: 'medium',
                overallScore: 8,
            });

            expect(result).toEqual({
                nextReview: '2026-02-26T00:00:00.000Z',
                intervalDays: 1,
                reviewCount: 1,
            });
        });

        it('should return null if reading back fails', async () => {
            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(null));
            (addToQueue as any).mockResolvedValue(undefined);

            const result = await upsertSpacedRepetition({
                userId: 'user-1',
                problemId: 'prob-1',
                overallScore: 8,
            });

            expect(result).toBeNull();
        });
    });

    describe('getReviewQueue', () => {
        it('should fetch due reviews checking against tomorrow', async () => {
            const mockDbData = [
                {
                    problem_id: 'p1',
                    problem_title: 'Title 1',
                    problem_difficulty: 'easy',
                    fsrs_due: '2026-02-25T00:00:00.000Z',
                    fsrs_reps: 2,
                    last_quality: 4,
                },
                {
                    problem_id: 'p2',
                    problem_title: 'Title 2',
                    problem_difficulty: 'hard',
                    fsrs_due: '2026-02-26T00:00:00.000Z',
                    fsrs_reps: 1,
                    last_quality: 3,
                },
            ];

            const supabaseMock = mockSupabaseResponse(mockDbData);
            (getServiceClient as any).mockReturnValue(supabaseMock);

            const result = await getReviewQueue('user-1');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                problemId: 'p1',
                problemTitle: 'Title 1',
                difficulty: 'easy',
                nextReview: '2026-02-25T00:00:00.000Z',
                reviewCount: 2,
                lastQuality: 4,
            });

            // Ensure we calculate 'tomorrow' correctly
            expect(formatNextReviewDate).toHaveBeenCalledWith(1);
        });

        it('should return an empty array on error', async () => {
            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(null, { message: 'db error' }));

            const result = await getReviewQueue('user-1');
            expect(result).toEqual([]);
        });
    });

    describe('getSpacedReviewForProblem', () => {
        it('should return the review schedule for a user and problem', async () => {
            const mockDbData = {
                interval: 6,
                fsrs_scheduled_days: 6,
                fsrs_due: '2026-03-03T00:00:00.000Z',
                fsrs_difficulty: null,
                fsrs_stability: null,
                fsrs_state: null,
                fsrs_reps: 2,
                fsrs_lapses: null,
            };

            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(mockDbData));

            const result = await getSpacedReviewForProblem('user-1', 'prob-1');

            expect(result).toEqual({
                intervalDays: 6,
                nextReview: '2026-03-03T00:00:00.000Z',
                reviewCount: 2,
                fsrsDifficulty: null,
                fsrsStability: null,
                fsrsState: null,
                fsrsReps: 2,
                fsrsLapses: null,
            });
        });

        it('should return null if the record does not exist', async () => {
            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(null));

            const result = await getSpacedReviewForProblem('user-1', 'prob-none');

            expect(result).toBeNull();
        });
    });
});
