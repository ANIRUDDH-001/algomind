/**
 * @codesage
 * @file      src/hooks/__tests__/useSessionPersistence.test.ts
 * @purpose   Unit tests for the useSessionPersistence React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useSessionPersistence
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
