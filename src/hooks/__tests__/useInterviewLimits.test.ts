// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInterviewLimits } from '../useInterviewLimits';

describe('useInterviewLimits — smoke + behaviour', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('mounts without throwing', () => {
        expect(() => renderHook(() => useInterviewLimits())).not.toThrow();
    });

    it('default state: not time up, not turns up, timer stopped', () => {
        const { result } = renderHook(() => useInterviewLimits());
        expect(result.current.isTimeUp).toBe(false);
        expect(result.current.isTurnsUp).toBe(false);
        expect(result.current.elapsedTime).toBe(0);
        expect(result.current.turnsUsed).toBe(0);
    });

    it('incrementTurn increases turnsUsed', () => {
        const { result } = renderHook(() => useInterviewLimits());
        act(() => { result.current.incrementTurn(); });
        expect(result.current.turnsUsed).toBe(1);
    });

    it('reset brings turnsUsed back to 0', () => {
        const { result } = renderHook(() => useInterviewLimits());
        act(() => { result.current.incrementTurn(); });
        act(() => { result.current.reset(); });
        expect(result.current.turnsUsed).toBe(0);
    });

    it('respects maxDurationMins option — formattedRemaining reflects custom limit', () => {
        const { result } = renderHook(() =>
            useInterviewLimits({ maxDurationMins: 5 })
        );
        // Before timer starts, timeRemaining should be 5 * 60 = 300 seconds
        expect(result.current.timeRemaining).toBe(300);
    });

    it('isTurnsUp becomes true after MAX_TURNS increments', () => {
        const { result } = renderHook(() => useInterviewLimits());
        const max = result.current.turnsRemaining + result.current.turnsUsed;
        // Increment to the limit
        act(() => {
            for (let i = 0; i < max; i++) {
                result.current.incrementTurn();
            }
        });
        expect(result.current.isTurnsUp).toBe(true);
    });
});
