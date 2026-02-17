/**
 * InterruptionManager — Coordinates STT, TTS, and LLM streaming to handle
 * conversation flow control and user interruptions during AI speech.
 *
 * This class is framework-agnostic (no React dependency) so it can be
 * unit-tested in isolation and consumed by hooks or other managers.
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
 * // Wire to VAD callbacks
 * vadManager.onSpeechStart(() => {
 *     const decision = im.handleUserSpeechStart();
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
 * // Wire to LLM abort
 * if (decision === 'INTERRUPT_IMMEDIATELY' && streamController) {
 *     im.cancelAIGeneration(streamController);
 * }
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
};

const INITIAL_STATE: InterruptionState = {
    isAISpeaking: false,
    isUserSpeaking: false,
    isAIThinking: false,
    canInterrupt: false,
    lastInterruptionTime: 0,
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (this._state as any)[key] = partial[key];
                changed = true;
            }
        }
        if (changed) {
            this._recalcCanInterrupt();
            this._emit(InterruptionEvent.STATE_CHANGE);
        }
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
     */
    handleUserSpeechStart(): InterruptionDecision {
        this._state.isUserSpeaking = true;

        // --- Debounce guard ---
        const now = Date.now();
        if (
            this._state.lastInterruptionTime > 0 &&
            now - this._state.lastInterruptionTime < this._config.debounceMs
        ) {
            this._emit(InterruptionEvent.DEBOUNCE, InterruptionDecision.IGNORE);
            return InterruptionDecision.IGNORE;
        }

        // --- Not speaking → normal input ---
        if (!this._state.isAISpeaking) {
            return InterruptionDecision.ALLOW_INPUT;
        }

        // --- AI speaking — check grace period ---
        const speakingDuration = now - this._aiSpeechStartTime;
        if (speakingDuration < this._config.graceMs) {
            return InterruptionDecision.WAIT;
        }

        // --- Grace period elapsed → interrupt ---
        this._state.lastInterruptionTime = now;
        this._recalcCanInterrupt();
        this._emit(InterruptionEvent.INTERRUPTION, InterruptionDecision.INTERRUPT_IMMEDIATELY);
        return InterruptionDecision.INTERRUPT_IMMEDIATELY;
    }

    /**
     * Called when VAD detects the user stopped speaking.
     *
     * Starts a confirmation timer (`speechEndConfirmMs`). If the user
     * doesn't start speaking again within that window, emits
     * `RESUMPTION` so the consumer knows the user is truly done.
     */
    handleUserSpeechEnd(): void {
        this._state.isUserSpeaking = false;
        this._recalcCanInterrupt();

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
        this._emit(InterruptionEvent.STATE_CHANGE);
    }

    /**
     * Call when TTS finishes speaking the full AI response (naturally,
     * or after an interruption has cancelled remaining chunks).
     */
    handleAIResponseComplete(): void {
        this._state.isAISpeaking = false;
        this._aiSpeechStartTime = 0;
        this._recalcCanInterrupt();
        this._emit(InterruptionEvent.STATE_CHANGE);
    }

    // ── Cancellation ────────────────────────────────────────────────

    /**
     * Cancel the browser's TTS via TTSManager (smooth fade-out).
     *
     * Falls back to raw `speechSynthesis.cancel()` if TTSManager
     * cannot be loaded (e.g. in tests or SSR).
     */
    async cancelAISpeech(): Promise<void> {
        try {
            const { getTTSManager } = await import('./tts-manager');
            await getTTSManager().cancel();
        } catch {
            // Fallback: raw cancel
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        }
        this._state.isAISpeaking = false;
        this._aiSpeechStartTime = 0;
        this._recalcCanInterrupt();
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
    }

    /**
     * Remove all event listeners. Useful on unmount.
     */
    removeAllListeners(): void {
        this._listeners.clear();
    }

    // ── Private helpers ─────────────────────────────────────────────

    /** Recompute `canInterrupt` from other state fields. */
    private _recalcCanInterrupt(): void {
        this._state.canInterrupt =
            this._state.isAISpeaking &&
            !this._state.isUserSpeaking &&
            Date.now() - this._aiSpeechStartTime >= this._config.graceMs;
    }

    /** Emit an event to all registered listeners. */
    private _emit(event: InterruptionEvent, decision?: InterruptionDecision): void {
        const data: InterruptionEventData = {
            timestamp: Date.now(),
            event,
            decision,
            state: { ...this._state },
        };
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
}
