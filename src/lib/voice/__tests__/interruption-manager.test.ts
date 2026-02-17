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

    // ── NEW: Initial state includes new fields ────────────────────

    test('initial state includes new debouncing fields', () => {
        const im = new InterruptionManager();
        const s = im.getState();
        expect(s.interruptionReadiness).toBe('blocked');
        expect(s.consecutiveFrameCount).toBe(0);
        expect(s.currentSpeechStartTime).toBe(0);
    });

    // ── NEW: handleVADFrame confidence filtering ─────────────────

    test('handleVADFrame returns true when confidence above threshold', () => {
        const im = new InterruptionManager({ minConfidence: 0.8 });
        expect(im.handleVADFrame(0.95)).toBe(true);
        expect(im.getState().consecutiveFrameCount).toBe(1);
    });

    test('handleVADFrame returns false and resets counter when below threshold', () => {
        const im = new InterruptionManager({ minConfidence: 0.8 });
        im.handleVADFrame(0.9);
        im.handleVADFrame(0.85);
        expect(im.getState().consecutiveFrameCount).toBe(2);

        im.handleVADFrame(0.5); // below threshold
        expect(im.getState().consecutiveFrameCount).toBe(0);
    });

    test('handleVADFrame accumulates consecutive high frames', () => {
        const im = new InterruptionManager({ minConfidence: 0.8 });
        im.handleVADFrame(0.9);
        im.handleVADFrame(0.85);
        im.handleVADFrame(0.92);
        expect(im.getState().consecutiveFrameCount).toBe(3);
    });

    // ── NEW: handleUserSpeechStartWithConfidence ─────────────────

    test('rejects speech start with low confidence', () => {
        const im = new InterruptionManager({ minConfidence: 0.8 });
        const listener = vi.fn();
        im.on(InterruptionEvent.CONFIDENCE_REJECT, listener);

        im.handleAIResponseStart();
        advanceTime(600);
        const d = im.handleUserSpeechStartWithConfidence(0.5);

        expect(d).toBe(InterruptionDecision.IGNORE);
        expect(listener).toHaveBeenCalledTimes(1);
        const evt = listener.mock.calls[0][0] as InterruptionEventData;
        expect(evt.confidence).toBe(0.5);
        expect(evt.source).toBe('vad');
    });

    test('WAITs when not enough consecutive frames', () => {
        const im = new InterruptionManager({
            minConfidence: 0.8,
            consecutiveHighFrames: 5,
        });
        im.handleAIResponseStart();
        advanceTime(600);

        // Only 2 frames accumulated
        im.handleVADFrame(0.9);
        im.handleVADFrame(0.85);
        const d = im.handleUserSpeechStartWithConfidence(0.9);
        expect(d).toBe(InterruptionDecision.WAIT);
    });

    test('INTERRUPT_IMMEDIATELY when confidence and frames pass', () => {
        const im = new InterruptionManager({
            graceMs: 500,
            minConfidence: 0.8,
            consecutiveHighFrames: 3,
        });
        im.handleAIResponseStart();
        advanceTime(600);

        // Accumulate enough frames
        im.handleVADFrame(0.9);
        im.handleVADFrame(0.85);
        im.handleVADFrame(0.92);

        const d = im.handleUserSpeechStartWithConfidence(0.9);
        expect(d).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
    });

    // ── NEW: Duration rejection on speech end ────────────────────

    test('emits DURATION_REJECT when speech too short', () => {
        const im = new InterruptionManager({ minSpeechDurationMs: 200 });
        const listener = vi.fn();
        im.on(InterruptionEvent.DURATION_REJECT, listener);

        im.handleUserSpeechStart(); // starts speech timer
        advanceTime(100); // only 100ms — below 200ms threshold
        im.handleUserSpeechEnd();

        expect(listener).toHaveBeenCalledTimes(1);
        const evt = listener.mock.calls[0][0] as InterruptionEventData;
        expect(evt.speechDurationMs).toBe(100);
    });

    test('does not emit DURATION_REJECT when speech long enough', () => {
        const im = new InterruptionManager({ minSpeechDurationMs: 200 });
        const listener = vi.fn();
        im.on(InterruptionEvent.DURATION_REJECT, listener);

        im.handleUserSpeechStart();
        advanceTime(300);
        im.handleUserSpeechEnd();

        expect(listener).not.toHaveBeenCalled();
    });

    // ── NEW: Manual controls ─────────────────────────────────────

    test('manualStop bypasses all debouncing', async () => {
        const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });
        const listener = vi.fn();
        im.on(InterruptionEvent.MANUAL_STOP, listener);

        im.handleAIResponseStart();
        advanceTime(100); // well within grace period

        await im.manualStop();

        // Should have stopped despite being in grace period
        expect(im.getState().isAISpeaking).toBe(false);
        expect(listener).toHaveBeenCalledTimes(1);
        const evt = listener.mock.calls[0][0] as InterruptionEventData;
        expect(evt.source).toBe('manual');
    });

    test('manualContinue emits MANUAL_CONTINUE event', () => {
        const im = new InterruptionManager();
        const listener = vi.fn();
        im.on(InterruptionEvent.MANUAL_CONTINUE, listener);

        im.manualContinue();

        expect(listener).toHaveBeenCalledTimes(1);
        const evt = listener.mock.calls[0][0] as InterruptionEventData;
        expect(evt.source).toBe('manual');
        expect(evt.reason).toBe('User pressed Continue button');
    });

    // ── NEW: Event stream circular buffer ────────────────────────

    test('getEventStream returns events in order', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(600);
        im.handleUserSpeechStart(); // generates INTERRUPTION event

        const stream = im.getEventStream();
        expect(stream.length).toBeGreaterThan(0);
        // Should contain STATE_CHANGE from handleAIResponseStart + INTERRUPTION
        expect(stream.some(e => e.event === InterruptionEvent.INTERRUPTION)).toBe(true);
    });

    test('event stream respects maxSize', () => {
        const im = new InterruptionManager({
            graceMs: 0,
            debounceMs: 0,
            eventStreamMaxSize: 5,
        });
        // Generate many events
        for (let i = 0; i < 10; i++) {
            im.handleAIResponseStart();
            im.handleAIResponseComplete();
        }
        // Each start/complete emits STATE_CHANGE → 20 events, but capped at 5
        expect(im.getEventStream().length).toBeLessThanOrEqual(5);
    });

    test('reset clears event stream', () => {
        const im = new InterruptionManager();
        im.handleAIResponseStart();
        im.reset();
        expect(im.getEventStream().length).toBe(0);
    });

    // ── NEW: setConfig hot-update ────────────────────────────────

    test('setConfig updates config at runtime', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.setConfig({ graceMs: 1000 });
        expect(im.getConfig().graceMs).toBe(1000);
    });

    test('getConfig returns frozen copy', () => {
        const im = new InterruptionManager();
        const cfg = im.getConfig();
        expect(Object.isFrozen(cfg)).toBe(true);
    });

    // ── NEW: Readiness state transitions ─────────────────────────

    test('readiness is blocked when AI not speaking', () => {
        const im = new InterruptionManager();
        expect(im.getReadiness()).toBe('blocked');
    });

    test('readiness is grace_period when AI just started speaking', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        expect(im.getReadiness()).toBe('grace_period');
    });

    test('readiness transitions to ready after grace period', () => {
        const im = new InterruptionManager({ graceMs: 500 });
        im.handleAIResponseStart();
        advanceTime(600);
        // Need to trigger recalc — updateState forces it
        im.updateState({ isAIThinking: false });
        // The updateState won't change since already false, but let's force it differently
        // Actually readiness is recalculated in handleAIResponseStart and updateState
        // We need to trigger _recalcReadiness after time has advanced
        im.handleAIResponseStart(); // re-call to trigger recalc at the new time
        // Actually this resets the start time. Let's check directly:
        const im2 = new InterruptionManager({ graceMs: 500 });
        im2.handleAIResponseStart();
        advanceTime(600);
        im2.updateState({ isAIThinking: true });
        expect(im2.getReadiness()).toBe('ready');
    });

    test('readiness is cooldown after interruption', () => {
        const im = new InterruptionManager({ graceMs: 100, debounceMs: 2000 });
        im.handleAIResponseStart();
        advanceTime(200); // past 100ms grace
        im.handleUserSpeechStart(); // triggers interruption at t=1200
        im.handleUserSpeechEnd();
        // Start AI speaking again
        im.handleAIResponseStart();
        advanceTime(200); // past 100ms grace for the new speech segment
        // But only 400ms since interruption (< 2000ms debounce)
        im.updateState({ isAIThinking: true });
        expect(im.getReadiness()).toBe('cooldown');
    });
});
