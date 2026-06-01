/**
 * @codesage
 * @file      src/hooks/__tests__/useReviewCount.test.ts
 * @purpose   Unit tests for the useReviewCount React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useReviewCount
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReviewCount, _resetReviewCountCache } from '../useReviewCount';

// Mock dependencies
const mockGetReviewQueue = vi.fn();
vi.mock('@/app/actions/spaced-repetition', () => ({
    getReviewQueue: (...args: unknown[]) => mockGetReviewQueue(...args),
}));

const mockUser = { id: 'user-123' };
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: mockUser }),
}));

describe('useReviewCount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        _resetReviewCountCache();
        mockGetReviewQueue.mockResolvedValue([]);
    });

    it('returns 0 when no reviews are due', async () => {
        mockGetReviewQueue.mockResolvedValue([]);
        const { result } = renderHook(() => useReviewCount());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.count).toBe(0);
    });

    it('returns correct count from getReviewQueue action', async () => {
        mockGetReviewQueue.mockResolvedValue([
            { problemId: 'p1', problemTitle: 'Two Sum', difficulty: 'easy', nextReview: '2026-01-01', repetitions: 1, lastQuality: 3 },
            { problemId: 'p2', problemTitle: 'Add Two Numbers', difficulty: 'medium', nextReview: '2026-01-01', repetitions: 2, lastQuality: 4 },
            { problemId: 'p3', problemTitle: 'Longest Substring', difficulty: 'hard', nextReview: '2026-01-01', repetitions: 0, lastQuality: null },
        ]);

        const { result } = renderHook(() => useReviewCount());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.count).toBe(3);
    });

    it('caches result for 5 minutes (second call within 5 mins = same result)', async () => {
        mockGetReviewQueue.mockResolvedValue([{ problemId: 'p1' }]);

        const { result: result1 } = renderHook(() => useReviewCount());
        await waitFor(() => expect(result1.current.isLoading).toBe(false));
        expect(result1.current.count).toBe(1);

        // Second call should use cache
        mockGetReviewQueue.mockResolvedValue([{ problemId: 'p1' }, { problemId: 'p2' }]);
        const { result: result2 } = renderHook(() => useReviewCount());
        await waitFor(() => expect(result2.current.isLoading).toBe(false));

        // Should still be 1 because of cache
        expect(result2.current.count).toBe(1);
        // getReviewQueue should only have been called once
        expect(mockGetReviewQueue).toHaveBeenCalledTimes(1);
    });

    it('isLoading is true during fetch, false after', async () => {
        let resolvePromise: (value: unknown[]) => void;
        mockGetReviewQueue.mockReturnValue(new Promise<unknown[]>(resolve => { resolvePromise = resolve; }));

        const { result } = renderHook(() => useReviewCount());

        // Initially loading
        expect(result.current.isLoading).toBe(true);

        // Resolve the promise
        resolvePromise!([]);

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.count).toBe(0);
    });
});
