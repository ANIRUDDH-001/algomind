// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(() => null),
    isSupabaseConfigured: vi.fn(() => false),
}));

import { useSessionPersistence } from '../useSessionPersistence';

describe('useSessionPersistence — smoke', () => {
    it('does not throw on mount (returns void)', () => {
        expect(() => renderHook(() => useSessionPersistence())).not.toThrow();
    });

    it('returns undefined (void hook)', () => {
        const { result } = renderHook(() => useSessionPersistence());
        expect(result.current).toBeUndefined();
    });
});
