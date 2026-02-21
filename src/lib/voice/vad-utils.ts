/**
 * Voice Activity Detection — browser support utilities.
 *
 * These helpers let consumers check VAD feasibility before paying
 * the cost of importing the heavy ONNX runtime.
 *
 * @module vad-utils
 */

// ---------------------------------------------------------------------------
// Browser support
// ---------------------------------------------------------------------------

/**
 * Browsers known to support the full VAD pipeline
 * (AudioContext + AudioWorklet + WASM SIMD + SharedArrayBuffer).
 */
export const VAD_SUPPORTED_BROWSERS = [
    'Chrome 66+',
    'Edge 79+',
    'Firefox 76+',
    'Safari 16.4+',
    'Opera 53+',
] as const;

/**
 * Checks whether the current environment supports Voice Activity Detection.
 *
 * Verifies:
 * 1. We're in a browser (not SSR).
 * 2. `AudioContext` (or `webkitAudioContext`) exists.
 * 3. `navigator.mediaDevices.getUserMedia` is available.
 * 4. `WebAssembly` is available (required by ONNX Runtime).
 *
 * @returns `true` if all required APIs are present.
 *
 * @example
 * ```ts
 * if (checkVADSupport()) {
 *   const vad = getVADManager();
 *   await vad.init();
 * }
 * ```
 */
export function checkVADSupport(): boolean {
    if (typeof window === 'undefined') return false;

    const hasAudioContext =
        typeof AudioContext !== 'undefined' ||
        typeof (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext !== 'undefined';

    const hasGetUserMedia =
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices?.getUserMedia === 'function';

    const hasWasm = typeof WebAssembly !== 'undefined';
    const hasAudioWorklet = typeof AudioWorkletNode !== 'undefined';

    return hasAudioContext && hasGetUserMedia && hasWasm && hasAudioWorklet;
}

// ---------------------------------------------------------------------------
// Error messages
// ---------------------------------------------------------------------------

/**
 * Maps a VAD-related error to a user-friendly message string.
 *
 * Recognises common failure modes (mic denied, no AudioContext, SSR, etc.)
 * and returns a short, actionable message.
 *
 * @param error - The error thrown during VAD init/start.
 * @returns A human-readable explanation.
 *
 * @example
 * ```ts
 * try {
 *   await vad.init();
 * } catch (err) {
 *   toast.error(getVADErrorMessage(err));
 * }
 * ```
 */
export function getVADErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
        return 'An unknown error occurred with Voice Activity Detection.';
    }

    const msg = error.message.toLowerCase();

    // Microphone permission
    if (msg.includes('permission') || msg.includes('not allowed') || msg.includes('denied')) {
        return 'Microphone access was denied. Please allow microphone permissions and try again.';
    }

    // AudioContext
    if (msg.includes('audiocontext')) {
        return 'Your browser does not support AudioContext. Please use a modern browser (Chrome, Edge, Firefox, or Safari).';
    }

    // getUserMedia
    if (msg.includes('getusermedia') || msg.includes('mediadevices')) {
        return 'Your browser does not support microphone access. Please use a modern browser.';
    }

    // SSR guard
    if (msg.includes('browser environment') || msg.includes('server-side')) {
        return 'Voice Activity Detection can only run in the browser.';
    }

    // ONNX / WASM
    if (msg.includes('onnx') || msg.includes('wasm') || msg.includes('model')) {
        return 'Failed to load the voice detection model. Please check your internet connection and try again.';
    }

    // Destroyed instance
    if (msg.includes('destroyed')) {
        return 'Voice Activity Detection was shut down. Please refresh the page.';
    }

    // Generic fallback — include original message for debugging
    return `Voice Activity Detection error: ${error.message}`;
}
