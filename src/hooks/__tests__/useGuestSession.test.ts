/**
 * @codesage
 * @file      src/hooks/__tests__/useGuestSession.test.ts
 * @purpose   Unit tests for the useGuestSession React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useGuestSession
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGuestSession, GUEST_SESSION_LIMITS, TURNS_PER_PROBLEM } from '../useGuestSession';

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

    it('GUEST_SESSION_LIMITS are set to 75', () => {
        expect(GUEST_SESSION_LIMITS.MAX_USER_TURNS).toBe(75);
        expect(GUEST_SESSION_LIMITS.MAX_AI_TURNS).toBe(75);
    });

    it('exports TURNS_PER_PROBLEM as 15', () => {
        expect(TURNS_PER_PROBLEM).toBe(15);
    });
});
