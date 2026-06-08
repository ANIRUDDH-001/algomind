/**
 * @codesage
 * @description Type definitions for the Voice Activity Detection (VAD) subsystem and InterruptionManager.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

// 

/**
 * Type definitions for Voice Activity Detection (VAD) subsystem.
 *
 * These types define the public contract for the VADManager class
 * and related configuration/callback interfaces.
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Lifecycle states for the VADManager. */
export enum VADState {
    /** No MicVAD instance exists yet. */
    IDLE = 'IDLE',
    /** MicVAD is being created (model download / AudioContext setup). */
    INITIALIZING = 'INITIALIZING',
    /** MicVAD is active and processing microphone frames. */
    LISTENING = 'LISTENING',
    /** MicVAD is paused (mic stream suspended). */
    PAUSED = 'PAUSED',
    /** An unrecoverable error occurred. */
    ERROR = 'ERROR',
    /** The instance has been destroyed and cannot be reused. */
    DESTROYED = 'DESTROYED',
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * User-facing configuration for the VAD engine.
 *
 * Maps to `@ricky0123/vad-web` `RealTimeVADOptions` internally, but
 * exposes only the knobs we care about.
 */
export interface VADConfig {
    /**
     * Probability threshold (0–1) above which a frame is classified as speech.
     * @default 0.8
     */
    positiveSpeechThreshold: number;

    /**
     * Probability threshold (0–1) below which a frame is classified as silence.
     * Should be lower than `positiveSpeechThreshold`.
     * @default 0.5
     */
    negativeSpeechThreshold: number;

    /**
     * Grace period (ms) after a silence frame before `onSpeechEnd` fires.
     * Prevents choppy detection during natural pauses.
     * @default 768
     */
    redemptionMs: number;

    /**
     * Milliseconds of audio to prepend before the detected speech start.
     * Prevents clipping the first syllable.
     * @default 250
     */
    preSpeechPadMs: number;

    /**
     * Minimum duration (ms) of a speech segment. Segments shorter than this
     * are discarded as misfires.
     * @default 250
     */
    minSpeechMs: number;

    /**
     * Silero model variant to use.
     * - `'legacy'` — smaller, faster, good enough for VAD
     * - `'v5'`     — newer, slightly more accurate
     * @default 'legacy'
     */
    model: 'v5' | 'legacy';

    /**
     * Base path where VAD assets (ONNX models, worklet JS) are served from.
     * Relative to the public root.
     * @default '/vad/'
     */
    baseAssetPath: string;

    /**
     * Base path where ONNX Runtime WASM files are served from.
     * @default '/vad/'
     */
    onnxWASMBasePath: string;
}

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

/** Fired when speech is first detected in the audio stream. */
export type SpeechStartCallback = () => void;

/**
 * Fired when speech ends.
 * @param audio - Float32Array of the captured speech segment (16kHz, mono, [-1, 1]).
 */
export type SpeechEndCallback = (audio: Float32Array) => void;

/** Fired when a detected speech segment is too short (`< minSpeechMs`). */
export type VADMisfireCallback = () => void;

/**
 * Fired on every processed frame with the speech probability.
 * Useful for visualising a "voice meter".
 */
export type FrameProcessedCallback = (probability: number) => void;

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/** Public contract for the VADManager singleton. */
export interface VADManagerInterface {
    /** Current lifecycle state. */
    readonly state: VADState;

    /**
     * Initialise the MicVAD instance. Requests microphone permission
     * and downloads the ONNX model if not cached.
     *
     * @throws if AudioContext is unsupported or mic access is denied.
     */
    init(config?: Partial<VADConfig>): Promise<void>;

    /** Begin processing microphone audio. Requires prior `init()`. */
    start(): Promise<void>;

    /** Pause processing (mic stream is suspended, not released). */
    stop(): Promise<void>;

    /** Register a callback for speech-start events. Returns an unsubscribe fn. */
    onSpeechStart(callback: SpeechStartCallback): () => void;

    /** Register a callback for speech-end events. Returns an unsubscribe fn. */
    onSpeechEnd(callback: SpeechEndCallback): () => void;

    /** Register a callback for misfire events. Returns an unsubscribe fn. */
    onMisfire(callback: VADMisfireCallback): () => void;

    /** Register a callback for per-frame probability. Returns an unsubscribe fn. */
    onFrameProcessed(callback: FrameProcessedCallback): () => void;

    /** Tear down the MicVAD, release mic, and invalidate this instance. */
    destroy(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Interruption Management
// ---------------------------------------------------------------------------

/** UI-facing readiness status for the interruption system. */
export type InterruptionReadiness = 'blocked' | 'grace_period' | 'cooldown' | 'ready';

/** Snapshot of the conversation-flow state tracked by InterruptionManager. */
export interface InterruptionState {
    /** True while TTS is actively speaking. */
    isAISpeaking: boolean;
    /** True while VAD detects user voice activity. */
    isUserSpeaking: boolean;
    /** True while an LLM request is in-flight (streaming or awaiting). */
    isAIThinking: boolean;
    /** Whether an interruption is allowed right now. */
    canInterrupt: boolean;
    /** Unix timestamp (ms) of the last successful interruption. */
    lastInterruptionTime: number;
    /** UI-facing readiness indicator. */
    interruptionReadiness: InterruptionReadiness;
    /** Consecutive VAD frames above confidence threshold. */
    consecutiveFrameCount: number;
    /** Timestamp when current speech segment began (0 if not speaking). */
    currentSpeechStartTime: number;
}

/**
 * Decision returned by `handleUserSpeechStart()`.
 *
 * The consumer (e.g. `useInterview`) should branch on this value to decide
 * whether to cancel TTS, wait, or ignore the event.
 */
export enum InterruptionDecision {
    /** AI is not speaking — treat as normal user input. */
    ALLOW_INPUT = 'ALLOW_INPUT',
    /** AI just started speaking (<grace period) — wait before interrupting. */
    WAIT = 'WAIT',
    /** AI has been speaking long enough — interrupt immediately. */
    INTERRUPT_IMMEDIATELY = 'INTERRUPT_IMMEDIATELY',
    /** Debounce guard — user spoke too recently, ignore. */
    IGNORE = 'IGNORE',
}

/** Events emitted by InterruptionManager for analytics/logging. */
export enum InterruptionEvent {
    /** User interrupted AI mid-speech. */
    INTERRUPTION = 'interruption',
    /** Conversation resumed after an interruption. */
    RESUMPTION = 'resumption',
    /** An interruption was ignored due to debounce. */
    DEBOUNCE = 'debounce',
    /** State changed (generic). */
    STATE_CHANGE = 'state_change',
    /** VAD event rejected due to low confidence. */
    CONFIDENCE_REJECT = 'confidence_reject',
    /** Speech segment too short (filler word). */
    DURATION_REJECT = 'duration_reject',
    /** User pressed the manual Stop button. */
    MANUAL_STOP = 'manual_stop',
    /** User pressed the manual Continue button. */
    MANUAL_CONTINUE = 'manual_continue',
    /** Debug/diagnostic log entry. */
    DIAGNOSTIC = 'diagnostic',
}

/** Payload carried with an InterruptionEvent. */
export interface InterruptionEventData {
    /** Unix timestamp (ms). */
    timestamp: number;
    /** Event discriminator. */
    event: InterruptionEvent;
    /** Decision that was made (for INTERRUPTION/DEBOUNCE events). */
    decision?: InterruptionDecision;
    /** Snapshot of state at event time. */
    state: InterruptionState;
    /** VAD confidence value that triggered or was rejected. */
    confidence?: number;
    /** How long the user spoke (ms) before the event. */
    speechDurationMs?: number;
    /** Human-readable reason for rejection/action. */
    reason?: string;
    /** What triggered the event. */
    source?: 'vad' | 'manual';
}

/** Listener signature for InterruptionManager events. */
export type InterruptionEventListener = (data: InterruptionEventData) => void;

/**
 * Configuration knobs for InterruptionManager.
 * All durations are in milliseconds.
 */
export interface InterruptionManagerConfig {
    /**
     * How long the AI must have been speaking before an interruption is
     * allowed. Prevents premature interruption on the very first syllable.
     * @default 500
     */
    graceMs: number;

    /**
     * Minimum interval between two successive interruptions from the user.
     * Rapid-fire interruptions within this window are ignored.
     * @default 1000
     */
    debounceMs: number;

    /**
     * Confirmation period (ms) after VAD `onSpeechEnd` before we consider
     * the user truly done speaking. Prevents premature auto-submit on
     * natural pauses.
     * @default 1000
     */
    speechEndConfirmMs: number;

    /**
     * VAD confidence threshold (0–1). Frames below this are discarded.
     * Filters out background noise, coughs, and non-speech sounds.
     * @default 0.85
     */
    minConfidence: number;

    /**
     * Speech segments shorter than this (ms) are treated as filler
     * words ("um", "uh") and ignored.
     * @default 300
     */
    minSpeechDurationMs: number;

    /**
     * Number of consecutive VAD frames above `minConfidence` required
     * before speech is considered intentional. Filters brief noise spikes.
     * @default 5
     */
    consecutiveHighFrames: number;

    /**
     * Enable verbose console logging for all decisions.
     * @default false
     */
    debugMode: boolean;

    /**
     * Maximum events kept in the circular diagnostic buffer.
     * @default 200
     */
    eventStreamMaxSize: number;
}
