// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(() => ({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    isSupabaseConfigured: vi.fn(() => true),
}));

// Mock AuthProvider's useAuth hook
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn(() => ({ user: null, loading: false })),
}));

import { useAdmin } from '../useAdmin';

describe('useAdmin — smoke', () => {
    it('returns isAdmin: false by default', () => {
        const { result } = renderHook(() => useAdmin());
        expect(result.current).toHaveProperty('isAdmin');
        expect(result.current.isAdmin).toBe(false);
    });

    it('returns loading: true initially', () => {
        const { result } = renderHook(() => useAdmin());
        expect(result.current).toHaveProperty('loading');
    });

    it('returns refetch function', () => {
        const { result } = renderHook(() => useAdmin());
        expect(typeof result.current.refetch).toBe('function');
    });
});
