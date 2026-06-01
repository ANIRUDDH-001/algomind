/**
 * @codesage
 * @file      src/hooks/__tests__/useProgress.test.ts
 * @purpose   Unit tests for the useProgress React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useProgress
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ user: null, loading: false })),
}));
vi.mock('@/lib/supabase/progress-store', () => ({
    getProgressStore: vi.fn(() => ({
        getUserProgress: vi.fn().mockResolvedValue(null),
        saveSession: vi.fn().mockResolvedValue(undefined),
    })),
}));
vi.mock('@/lib/supabase/client', () => ({
    isSupabaseConfigured: vi.fn(() => false),
}));
vi.mock('@tanstack/react-query', () => ({
    useQuery: vi.fn(() => ({ data: null, isLoading: false, error: null })),
    useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));
vi.mock('sonner', () => ({
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useProgress } from '../useProgress';

describe('useProgress — smoke', () => {
    it('does not throw on mount', () => {
        expect(() => renderHook(() => useProgress())).not.toThrow();
    });

    it('returns correct default shape', () => {
        const { result } = renderHook(() => useProgress());
        expect(result.current).toHaveProperty('progress');
        expect(result.current).toHaveProperty('history');
        expect(result.current).toHaveProperty('isLoading');
        expect(result.current).toHaveProperty('error');
        expect(typeof result.current.refresh).toBe('function');
        expect(typeof result.current.addSession).toBe('function');
    });
});
