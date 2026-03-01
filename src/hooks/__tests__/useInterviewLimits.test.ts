// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useInterviewLimits } from '../useInterviewLimits';

describe('useInterviewLimits — smoke', () => {
    it('does not throw on mount', () => {
        expect(() => renderHook(() => useInterviewLimits())).not.toThrow();
    });

    it('returns correct default shape', () => {
        const { result } = renderHook(() => useInterviewLimits());
        expect(result.current.elapsedTime).toBe(0);
        expect(result.current.turnsUsed).toBe(0);
        expect(result.current.turnsRemaining).toBe(20);
        expect(result.current.isTimeUp).toBe(false);
        expect(result.current.isTurnsUp).toBe(false);
        expect(result.current.shouldShowTurnWarning).toBe(false);
        expect(result.current.formattedElapsed).toBe('00:00');
        expect(typeof result.current.startTimer).toBe('function');
        expect(typeof result.current.stopTimer).toBe('function');
        expect(typeof result.current.incrementTurn).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });

    it('accepts custom maxDurationMins option', () => {
        const { result } = renderHook(() => useInterviewLimits({ maxDurationMins: 10 }));
        // 10 min = 600 sec remaining
        expect(result.current.timeRemaining).toBe(600);
    });
});
