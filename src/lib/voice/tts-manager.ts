/**
 * TTSManager — Singleton wrapper around the Web Speech Synthesis API.
 *
 * Enhancements over raw `speechSynthesis`:
 *   1. Sentence-level chunking (reuses `chunkTextForSpeech`)
 *   2. 50ms volume fade-out on cancel (prevents audio "pop")
 *   3. Browser-specific cancel paths (Chrome / Safari / Firefox)
 *   4. Queue management (cancel pending chunks, inspect queue)
 *   5. Event emitter (start, end, interrupt, chunk_start, chunk_end)
 *   6. Rapid start/stop guard
 *
 * Browser compatibility matrix:
 * ┌────────────┬──────────────────────────────────────────────┐
 * │ Browser    │ Cancel strategy                              │
 * ├────────────┼──────────────────────────────────────────────┤
 * │ Chrome 91+ │ Direct cancel() after volume fade            │
 * │ Safari 16+ │ pause() → 10ms delay → cancel()             │
 * │ Firefox 89+│ cancel() + onend fallback timer (200ms)      │
 * │ Edge 91+   │ Same as Chrome (Chromium-based)              │
 * └────────────┴──────────────────────────────────────────────┘
 *
 * @module tts-manager
 */

import { chunkTextForSpeech } from './text-chunker';
import { preprocessForTTS } from './tts-preprocessor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Events emitted by TTSManager. */
export enum TTSEvent {
    /** Entire speak() call started (first chunk about to play). */
    START = 'start',
    /** Entire speak() call completed (all chunks finished). */
    END = 'end',
    /** Speech was interrupted via cancel(). */
    INTERRUPT = 'interrupt',
    /** A single chunk began playing. */
    CHUNK_START = 'chunk_start',
    /** A single chunk finished playing. */
    CHUNK_END = 'chunk_end',
}

export interface TTSEventData {
    event: TTSEvent;
    /** Current chunk text (for CHUNK_START / CHUNK_END). */
    text?: string;
    /** Index of the chunk in the queue (0-based). */
    chunkIndex?: number;
    /** Total chunks in this speak() call. */
    totalChunks?: number;
    /** Unix timestamp. */
    timestamp: number;
}

export type TTSEventListener = (data: TTSEventData) => void;

export interface TTSOptions {
    voice?: SpeechSynthesisVoice | null;
    rate?: number;
    pitch?: number;
    volume?: number;
}

// ---------------------------------------------------------------------------
// Browser detection (cached)
// ---------------------------------------------------------------------------

type BrowserType = 'safari' | 'firefox' | 'chrome';

function detectBrowser(): BrowserType {
    if (typeof navigator === 'undefined') return 'chrome';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) {
        return 'safari';
    }
    if (ua.includes('firefox')) {
        return 'firefox';
    }
    return 'chrome'; // Chrome, Edge, Opera, etc.
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Duration of the volume fade-out ramp (ms). */
const FADE_DURATION_MS = 50;
/** Volume fade steps (linear ramp). */
const FADE_STEPS = 5;
/** Firefox onend fallback timeout (ms). */
const FIREFOX_ONEND_FALLBACK_MS = 200;
/** Minimum gap between successive cancel() calls to avoid races. */
const CANCEL_DEBOUNCE_MS = 50;

// ---------------------------------------------------------------------------
// TTSManager
// ---------------------------------------------------------------------------

export class TTSManager {
    private _queue: string[] = [];
    private _isPlaying = false;
    private _isPaused = false;
    private _currentUtterance: SpeechSynthesisUtterance | null = null;
    private _options: TTSOptions = {};
    private _processing = false;
    private _cancelledFlag = false;

    // Event emitter
    private _listeners: Map<TTSEvent, Set<TTSEventListener>> = new Map();

    // Browser type (cached)
    private _browser: BrowserType;

    // Debounce guard for cancel
    private _lastCancelTime = 0;

    // Firefox onend fallback timer
    private _firefoxFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    // Track total chunks for current speak() call
    private _totalChunks = 0;
    private _currentChunkIndex = 0;

    constructor(options?: TTSOptions & { /** @internal test-only override */ _browserOverride?: BrowserType }) {
        const { _browserOverride, ...ttsOpts } = options ?? {};
        this._options = { ...ttsOpts };
        this._browser = _browserOverride ?? detectBrowser();
    }

    // ── Public API ──────────────────────────────────────────────────

    /**
     * Speak the given text. Text is preprocessed for TTS pronunciation
     * and chunked into sentences for reliable playback.
     *
     * If already speaking, the current speech is cancelled first.
     */
    async speak(text: string, options?: TTSOptions): Promise<void> {
        if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
            return;
        }

        // Cancel any ongoing speech first
        if (this._isPlaying) {
            await this.cancel();
        }

        // Merge options
        const opts = { ...this._options, ...options };

        // Preprocess and chunk
        const cleanText = text.replace(/[*_#`]/g, '');
        const processed = preprocessForTTS(cleanText);
        this._queue = chunkTextForSpeech(processed);
        this._totalChunks = this._queue.length;
        this._currentChunkIndex = 0;
        this._cancelledFlag = false;

        if (this._queue.length === 0) return;

        this._emit(TTSEvent.START);
        await this._processQueue(opts);
    }

    /** Stop immediately with volume fade-out. */
    stop(): void {
        this._cancelSync();
    }

    /** Pause the current utterance. Can be resumed with `resume()`. */
    pause(): void {
        if (!this._isPlaying || typeof window === 'undefined') return;
        window.speechSynthesis.pause();
        this._isPaused = true;
    }

    /** Resume a paused utterance. */
    resume(): void {
        if (!this._isPaused || typeof window === 'undefined') return;
        window.speechSynthesis.resume();
        this._isPaused = false;
    }

    /**
     * Cancel all speech with a smooth volume fade-out.
     * Clears pending queue and resets state.
     */
    async cancel(): Promise<void> {
        // Debounce rapid cancel calls
        const now = Date.now();
        if (now - this._lastCancelTime < CANCEL_DEBOUNCE_MS) {
            return;
        }
        this._lastCancelTime = now;

        const wasPlaying = this._isPlaying;
        this._cancelledFlag = true;

        // Fade out volume if we have an active utterance
        if (this._currentUtterance && this._isPlaying) {
            await this._fadeOutVolume(this._currentUtterance);
        }

        // Browser-specific cancel
        this._browserCancel();

        // Cleanup state
        this._queue = [];
        this._isPlaying = false;
        this._isPaused = false;
        this._processing = false;
        this._currentUtterance = null;
        this._currentChunkIndex = 0;
        this._totalChunks = 0;

        if (wasPlaying) {
            this._emit(TTSEvent.INTERRUPT);
        }
    }

    /** Whether TTS is currently playing audio. */
    isPlaying(): boolean {
        return this._isPlaying;
    }

    /** Get a copy of the pending text chunks in the queue. */
    getQueue(): string[] {
        return [...this._queue];
    }

    /** Clear the pending queue without stopping the current chunk. */
    clearQueue(): void {
        this._queue = [];
    }

    /** Set default options for all future speak() calls. */
    setOptions(options: Partial<TTSOptions>): void {
        this._options = { ...this._options, ...options };
    }

    /**
     * Subscribe to a TTSEvent.
     * @returns Unsubscribe function.
     */
    on(event: TTSEvent, listener: TTSEventListener): () => void {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event)!.add(listener);
        return () => {
            this._listeners.get(event)?.delete(listener);
        };
    }

    /** Remove all event listeners. */
    removeAllListeners(): void {
        this._listeners.clear();
    }

    /** Tear down the manager. Cancel speech and remove listeners. */
    destroy(): void {
        this._cancelSync();
        this.removeAllListeners();
        this._clearFirefoxFallback();
    }

    // ── Internal ────────────────────────────────────────────────────

    /**
     * Process the chunk queue sequentially. Each chunk is spoken as a
     * separate SpeechSynthesisUtterance so the browser doesn't time out
     * on long text.
     */
    private async _processQueue(opts: TTSOptions): Promise<void> {
        if (this._processing) return;
        this._processing = true;
        this._isPlaying = true;

        // Small delay for browser audio context readiness
        await this._delay(50);

        while (this._queue.length > 0 && !this._cancelledFlag) {
            if (this._isPaused) {
                await this._delay(100);
                continue;
            }

            const chunk = this._queue.shift()!;
            this._currentChunkIndex++;

            this._emit(TTSEvent.CHUNK_START, {
                text: chunk,
                chunkIndex: this._currentChunkIndex - 1,
                totalChunks: this._totalChunks,
            });

            await this._speakChunk(chunk, opts);

            if (!this._cancelledFlag) {
                this._emit(TTSEvent.CHUNK_END, {
                    text: chunk,
                    chunkIndex: this._currentChunkIndex - 1,
                    totalChunks: this._totalChunks,
                });
            }
        }

        this._isPlaying = false;
        this._processing = false;
        this._currentUtterance = null;

        if (!this._cancelledFlag) {
            this._emit(TTSEvent.END);
        }
    }

    /** Speak a single text chunk and resolve when it finishes. */
    private _speakChunk(text: string, opts: TTSOptions): Promise<void> {
        return new Promise<void>((resolve) => {
            if (typeof window === 'undefined' || !window.speechSynthesis || this._cancelledFlag) {
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            if (opts.voice) utterance.voice = opts.voice;
            utterance.rate = opts.rate ?? 1.0;
            utterance.pitch = opts.pitch ?? 1.0;
            utterance.volume = opts.volume ?? 1.0;

            this._currentUtterance = utterance;

            let resolved = false;
            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    this._clearFirefoxFallback();
                    resolve();
                }
            };

            utterance.onend = finish;
            utterance.onerror = (e) => {
                // Ignore standard interruption/cancellation errors
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error('[TTSManager] Utterance error:', e.error);
                }
                finish();
            };

            window.speechSynthesis.speak(utterance);

            // Firefox: onend sometimes doesn't fire after cancel
            if (this._browser === 'firefox') {
                this._firefoxFallbackTimer = setTimeout(() => {
                    if (!resolved && this._cancelledFlag) {
                        finish();
                    }
                }, FIREFOX_ONEND_FALLBACK_MS + text.length * 20);
            }
        });
    }

    /**
     * Linearly ramp the utterance volume from current to 0 over FADE_DURATION_MS.
     * This prevents the audible "pop" when speech is abruptly cancelled.
     */
    private _fadeOutVolume(utterance: SpeechSynthesisUtterance): Promise<void> {
        return new Promise<void>((resolve) => {
            const startVolume = utterance.volume;
            if (startVolume <= 0) {
                resolve();
                return;
            }

            const stepDuration = FADE_DURATION_MS / FADE_STEPS;
            const volumeStep = startVolume / FADE_STEPS;
            let currentStep = 0;

            const interval = setInterval(() => {
                currentStep++;
                const newVolume = Math.max(0, startVolume - volumeStep * currentStep);
                utterance.volume = newVolume;

                if (currentStep >= FADE_STEPS) {
                    clearInterval(interval);
                    resolve();
                }
            }, stepDuration);
        });
    }

    /**
     * Browser-specific speechSynthesis.cancel() logic.
     */
    private _browserCancel(): void {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;

        switch (this._browser) {
            case 'safari':
                // Safari hangs if cancel() is called without pause() first
                window.speechSynthesis.pause();
                setTimeout(() => {
                    window.speechSynthesis.cancel();
                }, 10);
                break;

            case 'firefox':
                window.speechSynthesis.cancel();
                // Firefox may not fire onend — we use the fallback timer set in _speakChunk
                break;

            case 'chrome':
            default:
                window.speechSynthesis.cancel();
                break;
        }
    }

    /** Synchronous cancel — used by stop() and destroy(). */
    private _cancelSync(): void {
        this._cancelledFlag = true;
        this._browserCancel();
        this._queue = [];
        const wasPlaying = this._isPlaying;
        this._isPlaying = false;
        this._isPaused = false;
        this._processing = false;
        this._currentUtterance = null;
        this._currentChunkIndex = 0;
        this._totalChunks = 0;
        this._clearFirefoxFallback();
        if (wasPlaying) {
            this._emit(TTSEvent.INTERRUPT);
        }
    }

    private _clearFirefoxFallback(): void {
        if (this._firefoxFallbackTimer !== null) {
            clearTimeout(this._firefoxFallbackTimer);
            this._firefoxFallbackTimer = null;
        }
    }

    private _emit(event: TTSEvent, extra?: Partial<TTSEventData>): void {
        const data: TTSEventData = {
            event,
            timestamp: Date.now(),
            ...extra,
        };
        this._listeners.get(event)?.forEach((fn) => {
            try {
                fn(data);
            } catch (err) {
                console.error('[TTSManager] Listener error:', err);
            }
        });
    }

    private _delay(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: TTSManager | null = null;

/** Get or create the singleton TTSManager instance. */
export function getTTSManager(options?: TTSOptions): TTSManager {
    if (!_instance) {
        _instance = new TTSManager(options);
    }
    return _instance;
}

/** Destroy the singleton instance. */
export function resetTTSManager(): void {
    if (_instance) {
        _instance.destroy();
        _instance = null;
    }
}
