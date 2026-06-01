/**
 * @codesage
 * @file      src/lib/upstash/__tests__/degradation-circuit.test.ts
 * @purpose   Unit tests for the Upstash Redis circuit breaker logic.
 * @tech      Vitest
 * @connects  Imports from ../client
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __resetCircuitForTests,
    getCircuitState,
    isCircuitOpen,
    recordRedisAttempt,
} from '../client';

describe('upstash circuit breaker', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetCircuitForTests();
    });

    it('starts closed with zero errors', () => {
        const state = getCircuitState();
        expect(state.state).toBe('closed');
        expect(state.consecutiveErrors).toBe(0);
        expect(isCircuitOpen()).toBe(false);
    });

    it('transitions closed -> open after threshold failures', () => {
        for (let i = 0; i < 5; i++) {
            recordRedisAttempt(false, new Error('redis down'));
        }

        const state = getCircuitState();
        expect(state.state).toBe('open');
        expect(state.consecutiveErrors).toBe(5);
        expect(isCircuitOpen()).toBe(true);
    });

    it('transitions open -> half-open after recovery window', () => {
        for (let i = 0; i < 5; i++) {
            recordRedisAttempt(false, new Error('redis down'));
        }
        expect(getCircuitState().state).toBe('open');

        vi.advanceTimersByTime(60_001);
        expect(isCircuitOpen()).toBe(false);
        expect(getCircuitState().state).toBe('half-open');
    });

    it('transitions half-open -> closed after success', () => {
        for (let i = 0; i < 5; i++) {
            recordRedisAttempt(false, new Error('redis down'));
        }

        vi.advanceTimersByTime(60_001);
        isCircuitOpen();
        expect(getCircuitState().state).toBe('half-open');

        recordRedisAttempt(true);
        const state = getCircuitState();
        expect(state.state).toBe('closed');
        expect(state.consecutiveErrors).toBe(0);
    });

    it('transitions half-open -> open when failure recurs', () => {
        for (let i = 0; i < 5; i++) {
            recordRedisAttempt(false, new Error('redis down'));
        }

        vi.advanceTimersByTime(60_001);
        isCircuitOpen();
        expect(getCircuitState().state).toBe('half-open');

        recordRedisAttempt(false, new Error('still down'));
        const state = getCircuitState();
        expect(state.state).toBe('open');
        expect(state.consecutiveErrors).toBe(5);
    });
});
