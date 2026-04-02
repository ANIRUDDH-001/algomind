/**
 * Centralized voice configuration with tunable parameters.
 *
 * All values can be overridden at runtime via localStorage
 * (`algomind:voice-config`) so the admin panel can hot-tune them.
 *
 * @module voice-config
 */

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export interface VoiceConfigValues {
    // ── Debouncing ──────────────────────────────────────────────────
    /** AI must speak this long (ms) before interruption is allowed. */
    graceMs: number;
    /** Minimum interval (ms) between successive interruptions. */
    debounceMs: number;
    /** Silence (ms) before confirming user is done speaking. */
    speechEndConfirmMs: number;

    // ── Confidence & duration filters ───────────────────────────────
    /** VAD confidence below this is discarded (0–1). */
    minConfidence: number;
    /** Speech segments shorter than this (ms) are treated as filler. */
    minSpeechDurationMs: number;
    /** Need N consecutive high-confidence frames to trigger speech. */
    consecutiveHighFrames: number;

    // ── Diagnostics ─────────────────────────────────────────────────
    /** Enable verbose console logging for all decisions. */
    debugMode: boolean;
    /** Max events kept in the circular diagnostic buffer. */
    eventStreamMaxSize: number;

    /** Silence (ms) VAD waits before declaring speech ended. Default: 800ms. */
    vadSilenceWindowMs: number;

    /** STT restart delay after browser TTS (ms). Default: 1500ms. */
    sttRestartDelayBrowserTts: number;

    /** STT restart delay after Groq/Polly <audio> element (ms). Default: 200ms. */
    sttRestartDelayAudioElement: number;

    // ── VAD Engine Parameters ───────────────────────────────────────
    /** VAD confidence threshold to detect speech start (0–1). */
    vadPositiveSpeechThreshold: number;
    /** VAD confidence threshold to detect speech stop (0–1). */
    vadNegativeSpeechThreshold: number;
    /** Pause tolerance (ms) before closing a speech segment. */
    vadRedemptionMs: number;
    /** Minimum length (ms) to count as speech. */
    vadMinSpeechMs: number;
}

const DEFAULTS: VoiceConfigValues = {
    graceMs: 500,
    debounceMs: 1000,
    speechEndConfirmMs: 1000,

    minConfidence: 0.8,
    minSpeechDurationMs: 200,
    consecutiveHighFrames: 3,

    debugMode: false,
    eventStreamMaxSize: 200,

    vadSilenceWindowMs: 1800,
    sttRestartDelayBrowserTts: 300,
    sttRestartDelayAudioElement: 200,

    vadPositiveSpeechThreshold: 0.7,
    vadNegativeSpeechThreshold: 0.25,
    vadRedemptionMs: 1500,
    vadMinSpeechMs: 800,
};

// ---------------------------------------------------------------------------
// localStorage persistence key
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'algomind:voice-config';

// ---------------------------------------------------------------------------
// Read / write helpers
// ---------------------------------------------------------------------------

function readOverrides(): Partial<VoiceConfigValues> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as Partial<VoiceConfigValues>;
    } catch {
        return {};
    }
}

function writeOverrides(overrides: Partial<VoiceConfigValues>): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch {
        // Full quota — ignore
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get the merged config (defaults + localStorage overrides). */
export function getVoiceConfig(): VoiceConfigValues {
    return { ...DEFAULTS, ...readOverrides() };
}

/** Update one or more config values. Persists to localStorage. */
export function setVoiceConfig(partial: Partial<VoiceConfigValues>): VoiceConfigValues {
    const current = readOverrides();
    const merged = { ...current, ...partial };
    writeOverrides(merged);
    return { ...DEFAULTS, ...merged };
}

/** Reset all overrides back to defaults. */
export function resetVoiceConfig(): VoiceConfigValues {
    if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
    }
    return { ...DEFAULTS };
}

/** The immutable default values (useful for the admin UI "reset" label). */
export const VOICE_CONFIG_DEFAULTS = Object.freeze({ ...DEFAULTS });
