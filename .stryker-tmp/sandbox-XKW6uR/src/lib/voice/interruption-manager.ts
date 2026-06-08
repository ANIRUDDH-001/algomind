/**
 * @codesage
 * @description Coordinates STT, TTS, and LLM streaming for conversation flow control and handles user interruptions.
 * @summary Implements the InterruptionManager state machine which tracks AI vs User speaking states, debounce windows, grace periods, and triggers events for interruption or completion. Includes confidence filtering and consecutive frame requirements.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

/**
 * InterruptionManager — Coordinates STT, TTS, and LLM streaming to handle
 * conversation flow control and user interruptions during AI speech.
 *
 * This class is framework-agnostic (no React dependency) so it can be
 * unit-tested in isolation and consumed by hooks or other managers.
 *
 * v2 additions:
 * - Confidence-based VAD filtering (rejects frames < threshold)
 * - Speech duration validation (filters "um"/"uh" filler words)
 * - Consecutive frame counting (requires sustained speech, not noise spikes)
 * - Manual override controls (Stop/Continue bypass debouncing)
 * - Diagnostic event stream (circular buffer for admin debug panel)
 * - Hot-updatable config via `setConfig()`
 *
 * @example
 * ```ts
 * import { InterruptionManager } from '@/lib/voice/interruption-manager';
 *
 * const im = new InterruptionManager({ graceMs: 500, debounceMs: 1000 });
 *
 * // Subscribe to events (analytics, logging)
 * const unsub = im.on('interruption', (data) => {
 *     console.log('User interrupted at', data.timestamp);
 * });
 *
 * // Wire to VAD per-frame callback for confidence filtering
 * vadManager.onFrameProcessed((prob) => im.handleVADFrame(prob));
 *
 * // Wire to VAD speech callbacks (enhanced with confidence)
 * vadManager.onSpeechStart(() => {
 *     const decision = im.handleUserSpeechStartWithConfidence(0.95);
 *     if (decision === 'INTERRUPT_IMMEDIATELY') {
 *         voiceOutput.stop();
 *         sttInput.start();
 *     }
 * });
 *
 * vadManager.onSpeechEnd(() => im.handleUserSpeechEnd());
 *
 * // Wire to TTS lifecycle
 * voiceOutput.onStart = () => im.handleAIResponseStart();
 * voiceOutput.onEnd   = () => im.handleAIResponseComplete();
 *
 * // Manual controls (always work, bypass debouncing)
 * stopButton.onclick = () => im.manualStop();
 * continueButton.onclick = () => im.manualContinue();
 *
 * // Cleanup
 * im.reset();
 * unsub();
 * ```
 */

import type {
    InterruptionState,
    InterruptionManagerConfig,
    InterruptionEventData,
    InterruptionEventListener,
    InterruptionReadiness,
} from './types';
import {
    InterruptionDecision,
    InterruptionEvent,
} from './types';

// Re-export for convenience
export { InterruptionDecision, InterruptionEvent };

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: InterruptionManagerConfig = {
    graceMs: 500,
    debounceMs: 1000,
    speechEndConfirmMs: 1000,
    minConfidence: 0.85,
    minSpeechDurationMs: 300,
    consecutiveHighFrames: 5,
    debugMode: false,
    eventStreamMaxSize: 200,
};

const INITIAL_STATE: InterruptionState = {
    isAISpeaking: false,
    isUserSpeaking: false,
    isAIThinking: false,
    canInterrupt: false,
    lastInterruptionTime: 0,
    interruptionReadiness: 'blocked',
    consecutiveFrameCount: 0,
    currentSpeechStartTime: 0,
};

// ---------------------------------------------------------------------------
// InterruptionManager
// ---------------------------------------------------------------------------

export class InterruptionManager {
    // ── Internal state ──────────────────────────────────────────────
    private _state: InterruptionState;
    private _config: InterruptionManagerConfig;

    /** Timestamp (ms) when the AI started the current speech segment. */
    private _aiSpeechStartTime = 0;

    /** Pending timer for speech-end confirmation. */
    private _speechEndTimer: ReturnType<typeof setTimeout> | null = null;

    /** Event listeners keyed by event type. */
    private _listeners: Map<InterruptionEvent, Set<InterruptionEventListener>> = new Map();

    /** Circular buffer of diagnostic events. */
    private _eventStream: InterruptionEventData[] = [];

    // ── Constructor ─────────────────────────────────────────────────

    /**
     * @param config  Partial config; unset keys fall back to defaults.
     */
    constructor(config: Partial<InterruptionManagerConfig> = {}) {
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._state = { ...INITIAL_STATE };
    }

    // ── State accessors ─────────────────────────────────────────────

    /**
     * Return a frozen snapshot of the current state.
     * Callers cannot mutate the returned object.
     */
    getState(): Readonly<InterruptionState> {
        return Object.freeze({ ...this._state });
    }

    /**
     * Merge a partial update into the state.
     * Emits `STATE_CHANGE` if anything actually changed.
     */
    updateState(partial: Partial<InterruptionState>): void {
        let changed = false;
        for (const key of Object.keys(partial) as (keyof InterruptionState)[]) {
            if (this._state[key] !== partial[key]) {
                // TypeScript cannot infer that partial[key] matches this._state[key] when iterating
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this._state as any)[key] = partial[key];
                changed = true;
            }
        }
        if (changed) {
            this._recalcCanInterrupt();
            this._recalcReadiness();
            this._emit(InterruptionEvent.STATE_CHANGE);
        }
    }

    // ── VAD Frame Processing (NEW) ──────────────────────────────────

    /**
     * Process a single VAD frame's confidence score.
     *
     * Tracks consecutive high-confidence frames. If confidence is below
     * `minConfidence`, the counter resets (filters noise spikes, coughs).
     *
     * Call this from `VADManager.onFrameProcessed()`.
     *
     * @returns `true` if the frame is above the confidence threshold.
     */
    handleVADFrame(confidence: number): boolean {
        if (confidence >= this._config.minConfidence) {
            this._state.consecutiveFrameCount++;
            this._debugLog(
                `frame #${this._state.consecutiveFrameCount} conf=${confidence.toFixed(3)} ≥ ${this._config.minConfidence}`,
            );
            return true;
        }

        // Below threshold → reset counter
        if (this._state.consecutiveFrameCount > 0) {
            this._debugLog(
                `frame reset: conf=${confidence.toFixed(3)} < ${this._config.minConfidence} ` +
                `(was ${this._state.consecutiveFrameCount} frames)`,
            );
            this._state.consecutiveFrameCount = 0;
        }
        return false;
    }

    // ── Interruption Decision Logic ─────────────────────────────────

    /**
     * Called when VAD (or equivalent) detects the user started speaking.
     *
     * Returns a decision the caller should act on:
     *
     * | Scenario                          | Decision               |
     * |-----------------------------------|------------------------|
     * | AI not speaking                   | ALLOW_INPUT            |
     * | AI speaking < graceMs             | WAIT                   |
     * | AI speaking ≥ graceMs             | INTERRUPT_IMMEDIATELY  |
     * | User last interrupted < debounceMs| IGNORE                 |
     *
     * @deprecated Use `handleUserSpeechStartWithConfidence()` for confidence-aware filtering.
     */
    handleUserSpeechStart(): InterruptionDecision {
        return this._evaluateInterruption(undefined);
    }

    /**
     * Enhanced version of `handleUserSpeechStart` with confidence filtering.
     *
     * Validation chain:
     * 1. Confidence check → reject if below threshold
     * 2. Frame count check → reject if not enough consecutive frames
     * 3. Grace period → wait if AI just started speaking
     * 4. Debounce → ignore if user interrupted too recently
     * 5. All pass → interrupt immediately
     *
     * @param confidence  VAD confidence score (0–1).
     */
    handleUserSpeechStartWithConfidence(confidence: number): InterruptionDecision {
        // 1. Confidence check
        if (confidence < this._config.minConfidence) {
            this._debugLog(
                `REJECT: confidence ${confidence.toFixed(3)} < ${this._config.minConfidence}`,
            );
            this._emit(InterruptionEvent.CONFIDENCE_REJECT, InterruptionDecision.IGNORE, {
                confidence,
                reason: `Confidence ${confidence.toFixed(2)} below threshold ${this._config.minConfidence}`,
                source: 'vad',
            });
            return InterruptionDecision.IGNORE;
        }

        // 2. Frame count check
        if (this._state.consecutiveFrameCount < this._config.consecutiveHighFrames) {
            this._debugLog(
                `WAIT: only ${this._state.consecutiveFrameCount}/${this._config.consecutiveHighFrames} frames`,
            );
            return InterruptionDecision.WAIT;
        }

        // Pass to standard evaluation
        return this._evaluateInterruption(confidence);
    }

    /**
     * Called when VAD detects the user stopped speaking.
     *
     * Validates minimum speech duration. If the user spoke for less than
     * `minSpeechDurationMs`, the interruption is rejected as a filler word.
     *
     * Starts a confirmation timer (`speechEndConfirmMs`). If the user
     * doesn't start speaking again within that window, emits
     * `RESUMPTION` so the consumer knows the user is truly done.
     */
    handleUserSpeechEnd(): void {
        const now = Date.now();
        const speechDuration = this._state.currentSpeechStartTime > 0
            ? now - this._state.currentSpeechStartTime
            : 0;

        // Duration validation — reject filler words
        if (speechDuration > 0 && speechDuration < this._config.minSpeechDurationMs) {
            this._debugLog(
                `DURATION_REJECT: ${speechDuration}ms < ${this._config.minSpeechDurationMs}ms`,
            );
            this._emit(InterruptionEvent.DURATION_REJECT, InterruptionDecision.IGNORE, {
                speechDurationMs: speechDuration,
                reason: `Speech duration ${speechDuration}ms below minimum ${this._config.minSpeechDurationMs}ms`,
                source: 'vad',
            });
        }

        this._state.isUserSpeaking = false;
        this._state.currentSpeechStartTime = 0;
        this._state.consecutiveFrameCount = 0;
        this._recalcCanInterrupt();
        this._recalcReadiness();

        // Clear any existing confirmation timer
        this._clearSpeechEndTimer();

        this._speechEndTimer = setTimeout(() => {
            // User stayed silent for the confirmation period
            if (!this._state.isUserSpeaking) {
                this._emit(InterruptionEvent.RESUMPTION);
            }
        }, this._config.speechEndConfirmMs);
    }

    // ── AI Lifecycle ────────────────────────────────────────────────

    /**
     * Call when TTS begins speaking an AI response.
     * Marks the timestamp so `handleUserSpeechStart` can compute the
     * grace-period window.
     */
    handleAIResponseStart(): void {
        this._aiSpeechStartTime = Date.now();
        this._state.isAISpeaking = true;
        this._recalcCanInterrupt();
        this._recalcReadiness();
        this._emit(InterruptionEvent.STATE_CHANGE);
        this._debugLog('AI started speaking');
    }

    /**
     * Call when TTS finishes speaking the full AI response (naturally,
     * or after an interruption has cancelled remaining chunks).
     */
    handleAIResponseComplete(): void {
        this._state.isAISpeaking = false;
        this._aiSpeechStartTime = 0;
        this._recalcCanInterrupt();
        this._recalcReadiness();
        this._emit(InterruptionEvent.STATE_CHANGE);
        this._debugLog('AI finished speaking');
    }

    // ── Manual Overrides (NEW) ──────────────────────────────────────

    /**
     * Manual stop: bypasses ALL debouncing and immediately cancels AI speech.
     * Always works. Emits `MANUAL_STOP`.
     */
    async manualStop(): Promise<void> {
        this._debugLog('MANUAL_STOP: bypassing all checks');

        // Cancel TTS
        await this.cancelAISpeech();

        this._state.lastInterruptionTime = Date.now();
        this._recalcReadiness();

        this._emit(InterruptionEvent.MANUAL_STOP, InterruptionDecision.INTERRUPT_IMMEDIATELY, {
            reason: 'User pressed Stop button',
            source: 'manual',
        });
    }

    /**
     * Manual continue: signals that the AI should resume from an interrupted response.
     * Emits `MANUAL_CONTINUE` for the consumer to handle.
     */
    manualContinue(): void {
        this._debugLog('MANUAL_CONTINUE: user wants AI to continue');

        this._emit(InterruptionEvent.MANUAL_CONTINUE, undefined, {
            reason: 'User pressed Continue button',
            source: 'manual',
        });
    }

    // ── Cancellation ────────────────────────────────────────────────

    /**
     * Cancel the browser's TTS via TTSManager (smooth fade-out).
     *
     * Falls back to raw `speechSynthesis.cancel()` if TTSManager
     * cannot be loaded (e.g. in tests or SSR).
     */
    async cancelAISpeech(): Promise<void> {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        this._state.isAISpeaking = false;
        this._aiSpeechStartTime = 0;
        this._recalcCanInterrupt();
        this._recalcReadiness();
    }

    /**
     * Abort an in-flight LLM streaming request via its AbortController.
     *
     * Safe to call even if the controller has already aborted or the
     * request completed.
     */
    cancelAIGeneration(streamController: AbortController): void {
        try {
            if (!streamController.signal.aborted) {
                streamController.abort('User interrupted');
            }
        } catch {
            // Swallow — controller may already be spent
        }
        this._state.isAIThinking = false;
        this._recalcCanInterrupt();
        this._recalcReadiness();
    }

    // ── Readiness & Diagnostics (NEW) ───────────────────────────────

    /**
     * Returns the current UI-facing readiness status.
     */
    getReadiness(): InterruptionReadiness {
        return this._state.interruptionReadiness;
    }

    /**
     * Returns the circular buffer of diagnostic events.
     * Most recent events are at the end.
     */
    getEventStream(): readonly InterruptionEventData[] {
        return this._eventStream;
    }

    /**
     * Hot-update configuration at runtime. Useful for admin panel tuning.
     * Recalculates derived state after applying the update.
     */
    setConfig(partial: Partial<InterruptionManagerConfig>): void {
        this._config = { ...this._config, ...partial };
        this._recalcCanInterrupt();
        this._recalcReadiness();
        this._debugLog(`config updated: ${JSON.stringify(partial)}`);
    }

    /**
     * Read-only access to the current config (for UI display).
     */
    getConfig(): Readonly<InterruptionManagerConfig> {
        return Object.freeze({ ...this._config });
    }

    // ── Debounce Helper ─────────────────────────────────────────────

    /**
     * Returns `true` if enough time has passed since the last interruption
     * to process new user input. Useful as a pre-check before starting STT.
     */
    shouldProcessUserInput(): boolean {
        if (this._state.lastInterruptionTime === 0) return true;
        return Date.now() - this._state.lastInterruptionTime >= this._config.debounceMs;
    }

    // ── Event Emitter ───────────────────────────────────────────────

    /**
     * Subscribe to a specific interruption event.
     * @returns Unsubscribe function.
     *
     * @example
     * const unsub = manager.on('interruption', (data) => analytics.track(data));
     * // later…
     * unsub();
     */
    on(event: InterruptionEvent | `${InterruptionEvent}`, listener: InterruptionEventListener): () => void {
        const key = event as InterruptionEvent;
        if (!this._listeners.has(key)) {
            this._listeners.set(key, new Set());
        }
        this._listeners.get(key)!.add(listener);
        return () => {
            this._listeners.get(key)?.delete(listener);
        };
    }

    // ── Cleanup ─────────────────────────────────────────────────────

    /**
     * Reset all internal state to defaults and cancel pending timers.
     * Call this when the interview session ends or resets.
     */
    reset(): void {
        this._clearSpeechEndTimer();
        this._state = { ...INITIAL_STATE };
        this._aiSpeechStartTime = 0;
        this._eventStream = [];
    }

    /**
     * Remove all event listeners. Useful on unmount.
     */
    removeAllListeners(): void {
        this._listeners.clear();
    }

    // ── Private helpers ─────────────────────────────────────────────

    /**
     * Shared interruption evaluation logic.
     * Used by both `handleUserSpeechStart()` and `handleUserSpeechStartWithConfidence()`.
     */
    private _evaluateInterruption(confidence: number | undefined): InterruptionDecision {
        this._state.isUserSpeaking = true;
        this._state.currentSpeechStartTime = Date.now();

        // --- Debounce guard ---
        const now = Date.now();
        if (
            this._state.lastInterruptionTime > 0 &&
            now - this._state.lastInterruptionTime < this._config.debounceMs
        ) {
            this._debugLog(
                `DEBOUNCE: ${now - this._state.lastInterruptionTime}ms < ${this._config.debounceMs}ms`,
            );
            this._emit(InterruptionEvent.DEBOUNCE, InterruptionDecision.IGNORE, {
                confidence,
                reason: `Cooldown: ${now - this._state.lastInterruptionTime}ms since last interruption`,
                source: confidence !== undefined ? 'vad' : undefined,
            });
            return InterruptionDecision.IGNORE;
        }

        // --- Not speaking → normal input ---
        if (!this._state.isAISpeaking) {
            this._debugLog('ALLOW_INPUT: AI not speaking');
            return InterruptionDecision.ALLOW_INPUT;
        }

        // --- AI speaking — check grace period ---
        const speakingDuration = now - this._aiSpeechStartTime;
        if (speakingDuration < this._config.graceMs) {
            this._debugLog(
                `WAIT: AI speaking ${speakingDuration}ms < grace ${this._config.graceMs}ms`,
            );
            return InterruptionDecision.WAIT;
        }

        // --- Grace period elapsed → interrupt ---
        this._state.lastInterruptionTime = now;
        this._recalcCanInterrupt();
        this._recalcReadiness();

        this._debugLog(
            `INTERRUPT: AI speaking ${speakingDuration}ms, conf=${confidence?.toFixed(3) ?? 'n/a'}`,
        );
        this._emit(InterruptionEvent.INTERRUPTION, InterruptionDecision.INTERRUPT_IMMEDIATELY, {
            confidence,
            speechDurationMs: speakingDuration,
            source: confidence !== undefined ? 'vad' : undefined,
        });
        return InterruptionDecision.INTERRUPT_IMMEDIATELY;
    }

    /** Recompute `canInterrupt` from other state fields. */
    private _recalcCanInterrupt(): void {
        this._state.canInterrupt =
            this._state.isAISpeaking &&
            !this._state.isUserSpeaking &&
            Date.now() - this._aiSpeechStartTime >= this._config.graceMs;
    }

    /** Recompute the UI-facing readiness status. */
    private _recalcReadiness(): void {
        const now = Date.now();

        if (!this._state.isAISpeaking) {
            this._state.interruptionReadiness = 'blocked';
            return;
        }

        // Grace period?
        if (now - this._aiSpeechStartTime < this._config.graceMs) {
            this._state.interruptionReadiness = 'grace_period';
            return;
        }

        // Cooldown?
        if (
            this._state.lastInterruptionTime > 0 &&
            now - this._state.lastInterruptionTime < this._config.debounceMs
        ) {
            this._state.interruptionReadiness = 'cooldown';
            return;
        }

        this._state.interruptionReadiness = 'ready';
    }

    /** Emit an event to all registered listeners and push to event stream. */
    private _emit(
        event: InterruptionEvent,
        decision?: InterruptionDecision,
        extra?: Partial<Pick<InterruptionEventData, 'confidence' | 'speechDurationMs' | 'reason' | 'source'>>,
    ): void {
        const data: InterruptionEventData = {
            timestamp: Date.now(),
            event,
            decision,
            state: { ...this._state },
            ...extra,
        };

        // Push to circular buffer
        this._eventStream.push(data);
        if (this._eventStream.length > this._config.eventStreamMaxSize) {
            this._eventStream.shift();
        }

        const listeners = this._listeners.get(event);
        if (listeners) {
            for (const fn of listeners) {
                try { fn(data); } catch (e) {
                    console.error('[InterruptionManager] Listener error:', e);
                }
            }
        }
    }

    /** Clear the speech-end confirmation timer if pending. */
    private _clearSpeechEndTimer(): void {
        if (this._speechEndTimer !== null) {
            clearTimeout(this._speechEndTimer);
            this._speechEndTimer = null;
        }
    }

    /** Log a debug message when debugMode is enabled. */
    private _debugLog(msg: string): void {
        if (!this._config.debugMode) return;
        const ts = Date.now();
        console.debug(`[IM ${ts}] ${msg}`);

        // Also push a DIAGNOSTIC event to the stream (but don't fan-out to listeners)
        this._eventStream.push({
            timestamp: ts,
            event: InterruptionEvent.DIAGNOSTIC,
            state: { ...this._state },
            reason: msg,
        });
        if (this._eventStream.length > this._config.eventStreamMaxSize) {
            this._eventStream.shift();
        }
    }
}
