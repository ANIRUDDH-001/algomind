import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upsertSpacedRepetition, getReviewQueue, getSpacedRepForProblem } from '../spaced-repetition';
import { addToQueue } from '@/lib/spaced-repetition/queue';
import { getServiceClient } from '@/lib/supabase/service';
import { formatNextReviewDate } from '@/lib/spaced-repetition/sm2';

// Mock dependencies
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

vi.mock('@/lib/spaced-repetition/queue', () => ({
    addToQueue: vi.fn(),
}));

vi.mock('@/lib/spaced-repetition/sm2', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/spaced-repetition/sm2')>();
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
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('upsertSpacedRepetition', () => {
        it('should call addToQueue and read back the new record', async () => {
            const mockDbData = {
                next_review: '2026-02-26',
                interval: 1,
                repetitions: 1,
                use_fsrs: false,
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
                nextReview: '2026-02-26',
                intervalDays: 1,
                repetitions: 1,
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
                    next_review: '2026-02-25',
                    repetitions: 2,
                    last_quality: 4,
                    use_fsrs: false,
                },
                {
                    problem_id: 'p2',
                    problem_title: 'Title 2',
                    problem_difficulty: 'hard',
                    next_review: '2026-02-26',
                    repetitions: 1,
                    last_quality: 3,
                    use_fsrs: false,
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
                nextReview: '2026-02-25',
                repetitions: 2,
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

    describe('getSpacedRepForProblem', () => {
        it('should return the SM2 record for a user and problem', async () => {
            const mockDbData = {
                interval: 6,
                next_review: '2026-03-03',
                repetitions: 2,
                ease_factor: 2.6,
                use_fsrs: false,
                fsrs_scheduled_days: null,
                fsrs_due: null,
                fsrs_difficulty: null,
                fsrs_stability: null,
                fsrs_state: null,
                fsrs_reps: null,
                fsrs_lapses: null,
            };

            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(mockDbData));

            const result = await getSpacedRepForProblem('user-1', 'prob-1');

            expect(result).toEqual({
                intervalDays: 6,
                nextReview: '2026-03-03',
                repetitions: 2,
                easeFactor: 2.6,
                fsrsDifficulty: null,
                fsrsStability: null,
                fsrsState: null,
                fsrsReps: null,
                fsrsLapses: null,
            });
        });

        it('should return null if the record does not exist', async () => {
            (getServiceClient as any).mockReturnValue(mockSupabaseResponse(null));

            const result = await getSpacedRepForProblem('user-1', 'prob-none');

            expect(result).toBeNull();
        });
    });
});
