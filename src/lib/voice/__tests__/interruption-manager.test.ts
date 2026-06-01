/**
 * @codesage
 * @description Tests for the InterruptionManager state machine and event handlers.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 * @skip: test-file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InterruptionManager, InterruptionEvent, InterruptionDecision } from '../interruption-manager';

describe('InterruptionManager', () => {
    let im: InterruptionManager;

    beforeEach(() => {
        vi.useFakeTimers();
        // Use a test config with predictable thresholds
        im = new InterruptionManager({
            graceMs: 500,
            debounceMs: 1000,
            speechEndConfirmMs: 1000,
            minConfidence: 0.85,
            minSpeechDurationMs: 300,
            consecutiveHighFrames: 5,
        });
    });

    afterEach(() => {
        im.removeAllListeners();
        im.reset();
        vi.runAllTimers();
        vi.useRealTimers();
    });

    /**
     * Helper to simulate enough VAD frames to pass the `consecutiveHighFrames`
     * threshold and trigger speech start.
     */
    const simulateSpeechStart = (confidence = 0.9): InterruptionDecision => {
        for (let i = 0; i < 5; i++) {
            im.handleVADFrame(confidence);
        }
        return im.handleUserSpeechStartWithConfidence(confidence);
    };

    it('1. No interruption when user speech is below threshold (low confidence or short frames)', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        im.handleAIResponseStart();
        vi.advanceTimersByTime(600); // Past grace period

        // 1a. Low confidence rejection
        const decision1 = im.handleUserSpeechStartWithConfidence(0.5); // Below 0.85
        expect(decision1).toBe(InterruptionDecision.IGNORE);

        // 1b. Not enough consecutive frames
        im.handleVADFrame(0.9);
        im.handleVADFrame(0.9);
        // Only 2 high frames, needs 5
        const decision2 = im.handleUserSpeechStartWithConfidence(0.9);
        expect(decision2).toBe(InterruptionDecision.WAIT);

        // Interruption event should not have fired
        expect(listener).not.toHaveBeenCalled();
    });

    it('2. Interruption fires when speech exceeds threshold while AI is speaking', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        // AI starts speaking
        im.handleAIResponseStart();

        // Wait past grace period
        vi.advanceTimersByTime(600);

        // User speaks with high confidence and enough frames
        const decision = simulateSpeechStart();

        expect(decision).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('3. Cooldown period: interruption cannot fire again within cooldown window', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);
        const debounceListener = vi.fn();
        im.on(InterruptionEvent.DEBOUNCE, debounceListener);

        im.handleAIResponseStart();
        vi.advanceTimersByTime(600);

        // First interruption works
        const decision1 = simulateSpeechStart();
        expect(decision1).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
        expect(listener).toHaveBeenCalledTimes(1);

        // Try again immediately (within 1000ms debounce window)
        vi.advanceTimersByTime(200);
        const decision2 = simulateSpeechStart();
        expect(decision2).toBe(InterruptionDecision.IGNORE);
        expect(listener).toHaveBeenCalledTimes(1); // Still 1
        expect(debounceListener).toHaveBeenCalledTimes(1); // Debounce event fired

        // Wait past debounce window
        vi.advanceTimersByTime(1000);
        const decision3 = simulateSpeechStart();
        expect(decision3).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
        expect(listener).toHaveBeenCalledTimes(2); // Now 2
    });

    it('4. Interruption does NOT fire when AI is not speaking (idle state)', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        // AI is idle (default state)
        const decision = simulateSpeechStart();

        // Should just be allowed input, no forceful interruption needed
        expect(decision).toBe(InterruptionDecision.ALLOW_INPUT);
        expect(listener).not.toHaveBeenCalled();
    });

    it('5. onInterruption callback receives correct context (confidence, duration, logic source)', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        im.handleAIResponseStart();
        vi.advanceTimersByTime(750); // AI speaking for 750ms

        simulateSpeechStart(0.95); // High confidence

        expect(listener).toHaveBeenCalledTimes(1);
        const data = listener.mock.calls[0][0];

        expect(data.event).toBe(InterruptionEvent.INTERRUPTION);
        expect(data.decision).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
        expect(data.confidence).toBe(0.95);
        expect(data.speechDurationMs).toBe(750); // AI speech duration at interruption time
        expect(data.source).toBe('vad');
        expect(data.state.isAISpeaking).toBe(true);
        expect(data.state.isUserSpeaking).toBe(true); // Set to true right before evaluate
    });

    it('6. reset() clears state and cooldown timer', () => {
        im.handleAIResponseStart();
        vi.advanceTimersByTime(600);
        simulateSpeechStart(); // Triggers lastInterruptionTime = Date.now()

        expect(im.getState().lastInterruptionTime).toBeGreaterThan(0);
        expect(im.getState().isAISpeaking).toBe(true);

        im.reset();

        const state = im.getState();
        expect(state.lastInterruptionTime).toBe(0);
        expect(state.isAISpeaking).toBe(false);
        expect(state.canInterrupt).toBe(false);
        expect(im.getEventStream()).toHaveLength(0);
    });

    it('7. Multiple rapid speech events: only one interruption event fires per phrase', () => {
        const listener = vi.fn();
        im.on(InterruptionEvent.INTERRUPTION, listener);

        im.handleAIResponseStart();
        vi.advanceTimersByTime(600);

        // Simulate rapid repeated processing bounds within the same phrase (bypassing consecutive checks)
        // E.g. user stuttering or continuous VAD bursts within the debounce window
        simulateSpeechStart();
        vi.advanceTimersByTime(100);
        simulateSpeechStart();
        vi.advanceTimersByTime(100);
        simulateSpeechStart();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('8. Integration: VAD start → speech sustained → interruption → cooldown → VAD stop', () => {
        const interruptionListener = vi.fn();
        const resumptionListener = vi.fn();
        const durationRejectListener = vi.fn();

        im.on(InterruptionEvent.INTERRUPTION, interruptionListener);
        im.on(InterruptionEvent.RESUMPTION, resumptionListener);
        im.on(InterruptionEvent.DURATION_REJECT, durationRejectListener);

        // 1. AI starts
        im.handleAIResponseStart();
        vi.advanceTimersByTime(600);

        // 2. VAD detects sustained speech frames
        for (let i = 0; i < 5; i++) { im.handleVADFrame(0.9); }
        const decision = im.handleUserSpeechStartWithConfidence(0.9);
        expect(decision).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
        expect(interruptionListener).toHaveBeenCalledTimes(1);

        // Let's pretend user speaks for longer than minSpeechDurationMs (300ms)
        vi.advanceTimersByTime(500);

        // 3. VAD stops
        im.handleUserSpeechEnd();

        // Ensure duration reject was NOT called (duration > 300)
        expect(durationRejectListener).not.toHaveBeenCalled();

        // Ensure resumption NOT YET called until speechEndConfirmMs (1000)
        expect(resumptionListener).not.toHaveBeenCalled();

        // 4. Cooldown / confirmation passes
        vi.advanceTimersByTime(1000);

        // Now resumption should fire representing final phrase boundary isolated
        expect(resumptionListener).toHaveBeenCalledTimes(1);
    });

    it('9. Returns INTERRUPT_IMMEDIATELY for high-confidence speech during AI talking', () => {
        im.handleAIResponseStart();
        vi.advanceTimersByTime(600); // Past grace
        const decision = simulateSpeechStart(0.95);
        expect(decision).toBe(InterruptionDecision.INTERRUPT_IMMEDIATELY);
    });

    it('10. Returns IGNORE for low-confidence VAD frame during AI talking', () => {
        im.handleAIResponseStart();
        vi.advanceTimersByTime(600); // Past grace
        const decision = im.handleUserSpeechStartWithConfidence(0.3);
        expect(decision).toBe(InterruptionDecision.IGNORE);
    });
});
