// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGuestTrial } from '../useGuestTrial';

describe('useGuestTrial — smoke', () => {
    it('does not throw on mount', () => {
        expect(() => renderHook(() => useGuestTrial(false))).not.toThrow();
    });

    it('returns correct default shape for non-guest', () => {
        const { result } = renderHook(() => useGuestTrial(false));
        expect(result.current.turnsUsed).toBe(0);
        expect(result.current.isTrialComplete).toBe(false);
        expect(result.current.showLoginPrompt).toBe(false);
        expect(typeof result.current.recordTurn).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });
});
