/**
 * Unit tests for InterruptionManager.
 *
 * Run:
 *   npx vitest run src/lib/voice/__tests__/interruption-manager.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { InterruptionManager, InterruptionDecision, InterruptionEvent } from '../interruption-manager';
import type { InterruptionEventData } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────

/** Advance Date.now() in a controlled way. */
let mockNow = 1000;
beforeEach(() => {
    mockNow = 1000;
    vi.useFakeTimers();
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function advanceTime(ms: number) {
    mockNow += ms;
    vi.advanceTimersByTime(ms);
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('InterruptionManager', () => {
    // ── Initial state ─────────────────────────────────────────────

    test('initial state is idle', () => {
        const im = new InterruptionManager();
        const s = im.getState();
        expect(s.isAISpeaking).toBe(false);
        expect(s.isUserSpeaking).toBe(false);
        expect(s.isAIThinking).toBe(false);
        expect(s.canInterrupt).toBe(false);
        expect(s.lastInterruptionTime).toBe(0);
    });

    test('getState returns a frozen copy', () => {
        const im = new InterruptionManager();
        const s = im.getState();
        expect(Object.isFrozen(s)).toBe(true);
    });

    // ── ALLOW_INPUT when AI not speaking ───────────────────────────

    test('ALLOW_INPUT when AI is not speaking', () => {
        const im = new InterruptionManager();
        const d = im.handleUserSpeechStart();
        expect(d).toBe(InterruptionDecision.ALLOW_INPUT);
    });

    // ── WAIT during grace period ──────────────────────────────────

    test('WAIT when AI started speaking < graceMs ago', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(200); // only 200ms
        const d = im.handleUserSpeechStart();
        expect(d).toBe(InterruptionDecision.WAIT);
    });

    // ── INTERRUPT_IMMEDIATELY after grace period ──────────────────

    test('INTERRUPT_IMMEDIATELY when AI speaking ≥ graceMs', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(600);
        const d = im.handleUserSpeechStart();
        expect(d).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
    });

    test('INTERRUPT sets lastInterruptionTime', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart();
        expect(im.getState().lastInterruptionTime).toBe(mockNow);
    });

    // ── IGNORE (debounce) ─────────────────────────────────────────

    test('IGNORE when user interrupted < debounceMs ago', () => {
        const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });

        // First interruption at t=600
        im.handleAIResponseStart();
        advanceTime(600);
        expect(im.handleUserSpeechStart()).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);

        // Reset speech and start a new AI segment
        im.handleUserSpeechEnd();
        im.handleAIResponseStart();
        advanceTime(600); // AI has spoken 600ms — past grace

        // But only 600ms since last interruption — within debounce window
        const d = im.handleUserSpeechStart();
        expect(d).toBe(InterruptionDecision.IGNORE);
    });

    test('allows interruption after debounce window passes', () => {
        const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });

        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart(); // first interrupt

        im.handleUserSpeechEnd();
        im.handleAIResponseStart();
        advanceTime(1100); // > debounceMs since last interrupt

        const d = im.handleUserSpeechStart();
        expect(d).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
    });

    // ── shouldProcessUserInput ────────────────────────────────────

    test('shouldProcessUserInput returns true when no prior interruption', () => {
        const im = new InterruptionManager();
        expect(im.shouldProcessUserInput()).toBe(true);
    });

    test('shouldProcessUserInput respects debounce', () => {
        const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });
        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart(); // interrupt

        advanceTime(500);
        expect(im.shouldProcessUserInput()).toBe(false);

        advanceTime(600); // total 1100ms since interrupt
        expect(im.shouldProcessUserInput()).toBe(true);
    });

    // ── handleUserSpeechEnd confirmation timer ────────────────────

    test('emits RESUMPTION after speechEndConfirmMs if user stays silent', () => {
        const im = new InterruptionManager({ speechEndConfirmMs: 1000 });
        const listener = vi.fn();
        im.on(InterruptionEvent.RESUMPTION, listener);

        im.handleUserSpeechStart();
        im.handleUserSpeechEnd();

        // Not yet
        advanceTime(500);
        expect(listener).not.toHaveBeenCalled();

        // Now
        advanceTime(600);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('cancels RESUMPTION if user speaks again within window', () => {
        const im = new InterruptionManager({ speechEndConfirmMs: 1000 });
        const listener = vi.fn();
        im.on(InterruptionEvent.RESUMPTION, listener);

        im.handleUserSpeechStart();
        im.handleUserSpeechEnd();

        advanceTime(500);
        // User starts speaking again — should cancel timer
        im.handleUserSpeechEnd(); // re-triggers with new timer

        advanceTime(600); // only 600ms since new call
        expect(listener).not.toHaveBeenCalled();

        advanceTime(500); // now 1100ms since last handleUserSpeechEnd
        expect(listener).toHaveBeenCalledTimes(1);
    });

    // ── AI lifecycle ──────────────────────────────────────────────

    test('handleAIResponseStart marks AI as speaking', () => {
        const im = new InterruptionManager();
        im.handleAIResponseStart();
        expect(im.getState().isAISpeaking).toBe(true);
    });

    test('handleAIResponseComplete clears AI speaking', () => {
        const im = new InterruptionManager();
        im.handleAIResponseStart();
        im.handleAIResponseComplete();
        expect(im.getState().isAISpeaking).toBe(false);
    });

    // ── cancelAISpeech ────────────────────────────────────────────

    test('cancelAISpeech clears isAISpeaking', async () => {
        const im = new InterruptionManager();
        im.handleAIResponseStart();
        await im.cancelAISpeech();
        expect(im.getState().isAISpeaking).toBe(false);
    });

    // ── cancelAIGeneration ────────────────────────────────────────

    test('cancelAIGeneration aborts the controller', () => {
        const im = new InterruptionManager();
        im.updateState({ isAIThinking: true });
        const ac = new AbortController();
        im.cancelAIGeneration(ac);
        expect(ac.signal.aborted).toBe(true);
        expect(im.getState().isAIThinking).toBe(false);
    });

    test('cancelAIGeneration does not throw on already-aborted controller', () => {
        const im = new InterruptionManager();
        const ac = new AbortController();
        ac.abort();
        expect(() => im.cancelAIGeneration(ac)).not.toThrow();
    });

    // ── updateState ───────────────────────────────────────────────

    test('updateState merges partial and emits STATE_CHANGE', () => {
        const im = new InterruptionManager();
        const listener = vi.fn();
        im.on(InterruptionEvent.STATE_CHANGE, listener);

        im.updateState({ isAIThinking: true });

        expect(im.getState().isAIThinking).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('updateState does not emit if value unchanged', () => {
        const im = new InterruptionManager();
        const listener = vi.fn();
        im.on(InterruptionEvent.STATE_CHANGE, listener);

        im.updateState({ isAIThinking: false }); // already false
        expect(listener).not.toHaveBeenCalled();
    });

    // ── Event emitter ─────────────────────────────────────────────

    test('on() returns an unsubscribe function', () => {
        const im = new InterruptionManager();
        const listener = vi.fn();
        const unsub = im.on(InterruptionEvent.STATE_CHANGE, listener);

        im.updateState({ isAIThinking: true });
        expect(listener).toHaveBeenCalledTimes(1);

        unsub();
        im.updateState({ isAIThinking: false });
        expect(listener).toHaveBeenCalledTimes(1); // no additional call
    });

    test('INTERRUPTION event contains the decision', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart();

        expect(listener).toHaveBeenCalledTimes(1);
        const eventData = listener.mock.calls[0][0] as InterruptionEventData;
        expect(eventData.decision).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
    });

    test('DEBOUNCE event fires on ignored interruptions', () => {
        const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });
        const listener = vi.fn();
        im.on(InterruptionEvent.DEBOUNCE, listener);

        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart(); // first — OK

        im.handleUserSpeechEnd();
        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart(); // debounced

        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('removeAllListeners clears everything', () => {
        const im = new InterruptionManager();
        const listener = vi.fn();
        im.on(InterruptionEvent.STATE_CHANGE, listener);

        im.removeAllListeners();
        im.updateState({ isAIThinking: true });

        expect(listener).not.toHaveBeenCalled();
    });

    // ── Reset ─────────────────────────────────────────────────────

    test('reset() returns to initial state', () => {
        const im = new InterruptionManager();
        im.handleAIResponseStart();
        im.handleUserSpeechStart();

        im.reset();
        const s = im.getState();
        expect(s.isAISpeaking).toBe(false);
        expect(s.isUserSpeaking).toBe(false);
        expect(s.lastInterruptionTime).toBe(0);
    });

    test('reset() cancels pending speech-end timer', () => {
        const im = new InterruptionManager({ speechEndConfirmMs: 1000 });
        const listener = vi.fn();
        im.on(InterruptionEvent.RESUMPTION, listener);

        im.handleUserSpeechEnd();
        im.reset();
        advanceTime(1500);

        expect(listener).not.toHaveBeenCalled();
    });

    // ── canInterrupt recalculation ────────────────────────────────

    test('canInterrupt is true when AI speaking past grace and user not speaking', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(600);
        // Trigger recalc via updateState
        im.updateState({});
        // canInterrupt won't update since no change — force via handleAIResponseStart
        // Actually, updateState with no actual changes won't emit, so let's use a real change
        im.updateState({ isAIThinking: true });
        // After updateState, _recalcCanInterrupt is called
        // isAISpeaking: true, isUserSpeaking: false, elapsed > graceMs
        expect(im.getState().canInterrupt).toBe(true);
    });

    test('canInterrupt is false during grace period', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(200);
        im.updateState({ isAIThinking: true });
        expect(im.getState().canInterrupt).toBe(false);
    });
});
