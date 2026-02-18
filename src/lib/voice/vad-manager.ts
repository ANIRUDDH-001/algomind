/**
 * VADManager — Singleton wrapper around @ricky0123/vad-web MicVAD.
 *
 * Design decisions:
 * - Loads two pre-built scripts from /public/vad/ via &lt;script&gt; tags:
 *     1. ort.min.js (358 KB) — ONNX Runtime JS loader
 *     2. vad-bundle.min.js (69 KB) — VAD library (UMD, exports MicVAD)
 *   This avoids Turbopack trying to compile onnxruntime-web (120+ s in dev).
 * - Singleton pattern so multiple React components can share one mic stream.
 * - State machine prevents invalid transitions (e.g., start before init).
 * - All callbacks are stored in Sets so multiple subscribers are supported
 *   and each `on*` method returns an unsubscribe function.
 */

import type {
    VADConfig,
    VADManagerInterface,
    SpeechStartCallback,
    SpeechEndCallback,
    VADMisfireCallback,
    FrameProcessedCallback,
} from './types';
import { VADState } from './types';

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: VADConfig = {
    positiveSpeechThreshold: 0.9,   // Higher = less sensitive to background noise
    negativeSpeechThreshold: 0.35,  // Lower = stays in speech mode longer once triggered
    redemptionMs: 768,
    preSpeechPadMs: 250,
    minSpeechMs: 400,               // Ignore short bursts (<400ms) likely from noise
    model: 'legacy',
    baseAssetPath: '/vad/',
    onnxWASMBasePath: '/vad/',
};

// ---------------------------------------------------------------------------
// Script-tag loader (bypasses Turbopack compilation entirely)
// ---------------------------------------------------------------------------

interface MicVADInstance {
    listening: boolean;
    start: () => Promise<void>;
    pause: () => Promise<void>;
    destroy: () => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MicVADConstructor = { new: (options: Record<string, any>) => Promise<MicVADInstance> };

let _scriptsLoaded = false;
let _scriptLoadPromise: Promise<void> | null = null;

/** Load a single &lt;script&gt; and resolve when it finishes. */
function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        // Skip if already present in the DOM
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = () => resolve();
        el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(el);
    });
}

/**
 * Load ONNX Runtime + VAD bundle from /public/vad/.
 * Scripts are loaded sequentially: ort first (registers globalThis.ort),
 * then vad-bundle (registers the UMD module with MicVAD).
 */
function loadVADScripts(basePath: string): Promise<void> {
    if (_scriptsLoaded) return Promise.resolve();
    if (_scriptLoadPromise) return _scriptLoadPromise;

    _scriptLoadPromise = (async () => {
        // 1. ONNX Runtime must be available before the VAD bundle
        console.log('[VADManager] Loading ONNX Runtime…');
        await loadScript(`${basePath}ort.min.js`);

        // 2. VAD bundle (UMD — uses ort from step 1)
        console.log('[VADManager] Loading VAD library…');
        await loadScript(`${basePath}vad-bundle.min.js`);

        _scriptsLoaded = true;
        console.log('[VADManager] Scripts loaded.');
    })();

    _scriptLoadPromise.catch(() => {
        // Allow retry on failure
        _scriptLoadPromise = null;
    });

    return _scriptLoadPromise;
}

/**
 * Retrieve the MicVAD constructor from the global scope.
 *
 * The vad-bundle.min.js UMD build assigns to `window.vad` (or its UMD
 * root name). We also try common patterns the library may use.
 */
function getMicVADConstructor(): MicVADConstructor | null {
    if (typeof window === 'undefined') return null;

    // The UMD bundle typically exports to `window.vad`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;

    // Try the most common export patterns
    if (w.vad?.MicVAD) return w.vad.MicVAD;
    if (w.MicVAD) return w.MicVAD;

    // The UMD module variable name might differ — scan common names
    for (const key of Object.keys(w)) {
        const val = w[key];
        if (val && typeof val === 'object' && val.MicVAD) {
            return val.MicVAD;
        }
    }

    return null;
}

// ---------------------------------------------------------------------------
// VADManager
// ---------------------------------------------------------------------------

class VADManager implements VADManagerInterface {
    private _state: VADState = VADState.IDLE;
    private _micVAD: MicVADInstance | null = null;
    private _config: VADConfig = { ...DEFAULT_CONFIG };
    private _error: string | null = null;

    private _onSpeechStartCbs = new Set<SpeechStartCallback>();
    private _onSpeechEndCbs = new Set<SpeechEndCallback>();
    private _onMisfireCbs = new Set<VADMisfireCallback>();
    private _onFrameProcessedCbs = new Set<FrameProcessedCallback>();

    get state(): VADState {
        return this._state;
    }
    get error(): string | null {
        return this._error;
    }

    async init(config?: Partial<VADConfig>): Promise<void> {
        if (this._state !== VADState.IDLE) {
            if (this._state === VADState.DESTROYED) {
                throw new Error('VADManager has been destroyed. Create a new instance via getVADManager().');
            }
            console.warn(`[VADManager] init() called in state "${this._state}", ignoring.`);
            return;
        }

        this._state = VADState.INITIALIZING;
        this._config = { ...DEFAULT_CONFIG, ...config };

        try {
            this._assertBrowserSupport();

            // Test Hook: Force VAD failure for integration testing
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (typeof window !== 'undefined' && (window as any).__FORCE_VAD_FAILURE__) {
                console.log('PAGE LOG: Forcing VAD failure now');
                throw new Error('Forced VAD failure for testing');
            }

            // Allow dependency injection for tests (Playwright)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let MicVAD = (window as any).mockMicVAD;

            if (!MicVAD) {
                // Load scripts from /public/vad/ (instant — no bundler compilation)
                await loadVADScripts(this._config.baseAssetPath);
                MicVAD = getMicVADConstructor();
            }

            if (!MicVAD) {
                throw new Error(
                    'MicVAD not found after loading scripts. ' +
                    'Check that /vad/ort.min.js and /vad/vad-bundle.min.js are present.'
                );
            }

            console.log('[VADManager] Creating MicVAD instance…');
            this._micVAD = await MicVAD.new({
                positiveSpeechThreshold: this._config.positiveSpeechThreshold,
                negativeSpeechThreshold: this._config.negativeSpeechThreshold,
                redemptionMs: this._config.redemptionMs,
                preSpeechPadMs: this._config.preSpeechPadMs,
                minSpeechMs: this._config.minSpeechMs,
                model: this._config.model,
                baseAssetPath: this._config.baseAssetPath,
                onnxWASMBasePath: this._config.onnxWASMBasePath,
                startOnLoad: false,

                onSpeechStart: () => {
                    this._onSpeechStartCbs.forEach((cb) => {
                        try { cb(); } catch (err) {
                            console.error('[VADManager] onSpeechStart callback error:', err);
                        }
                    });
                },

                onSpeechEnd: (audio: Float32Array) => {
                    this._onSpeechEndCbs.forEach((cb) => {
                        try { cb(audio); } catch (err) {
                            console.error('[VADManager] onSpeechEnd callback error:', err);
                        }
                    });
                },

                onVADMisfire: () => {
                    this._onMisfireCbs.forEach((cb) => {
                        try { cb(); } catch (err) {
                            console.error('[VADManager] onVADMisfire callback error:', err);
                        }
                    });
                },

                onFrameProcessed: (probabilities: { isSpeech: number }) => {
                    if (this._onFrameProcessedCbs.size === 0) return;
                    const prob = probabilities.isSpeech;
                    this._onFrameProcessedCbs.forEach((cb) => {
                        try { cb(prob); } catch (err) {
                            console.error('[VADManager] onFrameProcessed callback error:', err);
                        }
                    });
                },
            });

            this._state = VADState.PAUSED;
            console.log('[VADManager] MicVAD ready ✓');
        } catch (err) {
            this._state = VADState.ERROR;
            this._error = err instanceof Error ? err.message : 'Unknown error during VAD initialisation';
            console.error('[VADManager] Init failed:', err);
            throw err;
        }
    }

    async start(): Promise<void> {
        this._assertReady('start');
        if (this._state === VADState.LISTENING) return;
        try {
            await this._micVAD!.start();
            this._state = VADState.LISTENING;
        } catch (err) {
            this._state = VADState.ERROR;
            this._error = err instanceof Error ? err.message : 'Failed to start VAD';
            throw err;
        }
    }

    async stop(): Promise<void> {
        if (this._state !== VADState.LISTENING) return;
        try {
            await this._micVAD!.pause();
            this._state = VADState.PAUSED;
        } catch (err) {
            console.error('[VADManager] Error pausing:', err);
        }
    }

    onSpeechStart(callback: SpeechStartCallback): () => void {
        this._onSpeechStartCbs.add(callback);
        return () => { this._onSpeechStartCbs.delete(callback); };
    }

    onSpeechEnd(callback: SpeechEndCallback): () => void {
        this._onSpeechEndCbs.add(callback);
        return () => { this._onSpeechEndCbs.delete(callback); };
    }

    onMisfire(callback: VADMisfireCallback): () => void {
        this._onMisfireCbs.add(callback);
        return () => { this._onMisfireCbs.delete(callback); };
    }

    onFrameProcessed(callback: FrameProcessedCallback): () => void {
        this._onFrameProcessedCbs.add(callback);
        return () => { this._onFrameProcessedCbs.delete(callback); };
    }

    async destroy(): Promise<void> {
        if (this._state === VADState.DESTROYED) return;
        try {
            if (this._micVAD) await this._micVAD.destroy();
        } catch (err) {
            console.error('[VADManager] Error during destroy:', err);
        } finally {
            this._micVAD = null;
            this._onSpeechStartCbs.clear();
            this._onSpeechEndCbs.clear();
            this._onMisfireCbs.clear();
            this._onFrameProcessedCbs.clear();
            this._state = VADState.DESTROYED;
            this._error = null;
        }
    }

    // --- Private helpers -----------------------------------------------------

    private _assertBrowserSupport(): void {
        if (typeof window === 'undefined') {
            throw new Error('VADManager requires a browser environment.');
        }
        const AudioCtx = window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) throw new Error('This browser does not support AudioContext.');
        if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error('This browser does not support getUserMedia.');
        }
        if (typeof WebAssembly === 'undefined') {
            throw new Error('This browser does not support WebAssembly.');
        }
    }

    private _assertReady(action: string): void {
        if (!this._micVAD) throw new Error(`VADManager.${action}() called before init().`);
        if (this._state === VADState.DESTROYED) throw new Error(`VADManager.${action}() after destroy.`);
        if (this._state === VADState.ERROR) {
            throw new Error(`VADManager in error state: ${this._error ?? 'unknown'}.`);
        }
    }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: VADManager | null = null;

export function getVADManager(): VADManager {
    if (!_instance || _instance.state === VADState.DESTROYED) {
        _instance = new VADManager();
    }
    return _instance;
}

export async function resetVADManager(): Promise<void> {
    if (_instance) {
        await _instance.destroy();
        _instance = null;
    }
}

export { VADManager };
