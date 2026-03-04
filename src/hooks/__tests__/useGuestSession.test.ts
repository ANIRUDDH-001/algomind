// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGuestSession, GUEST_SESSION_LIMITS } from '../useGuestSession';

describe('useGuestSession — smoke', () => {
    it('does not throw on mount', () => {
        expect(() => renderHook(() => useGuestSession(false))).not.toThrow();
    });

    it('returns correct default shape for non-guest', () => {
        const { result } = renderHook(() => useGuestSession(false));
        expect(result.current.userTurns).toBe(0);
        expect(result.current.aiTurns).toBe(0);
        expect(result.current.isTrialComplete).toBe(false);
        expect(result.current.showLoginPrompt).toBe(false);
        expect(typeof result.current.recordUserTurn).toBe('function');
        expect(typeof result.current.recordAITurn).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });

    it('GUEST_SESSION_LIMITS.MAX_USER_TURNS is 10 (guest mode)', () => {
        // This test guards against the limits being accidentally changed
        expect(GUEST_SESSION_LIMITS.MAX_USER_TURNS).toBe(10);
        expect(GUEST_SESSION_LIMITS.MAX_AI_TURNS).toBe(10);
    });
});
