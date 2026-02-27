/**
 * useVoiceActivityDetection — React hook for Voice Activity Detection.
 *
 * Wraps the singleton VADManager in a React-friendly API with proper
 * lifecycle management, lazy loading, and opt-in activation.
 *
 * @module useVoiceActivityDetection
 *
 * @example
 * ```tsx
 * import { useVoiceActivityDetection } from '@/hooks/useVoiceActivityDetection';
 *
 * function InterviewPanel() {
 *   const {
 *     isListening,
 *     isSpeaking,
 *     error,
 *     startListening,
 *     stopListening,
 *   } = useVoiceActivityDetection({
 *     enabled: true,          // opt-in
 *     autoStart: false,       // manual trigger
 *     onSpeechStart: () => console.log('User started speaking'),
 *     onSpeechEnd: () => console.log('User stopped speaking'),
 *     onError: (err) => console.error('VAD error', err),
 *   });
 *
 *   return (
 *     <div>
 *       <p>Listening: {isListening ? 'Yes' : 'No'}</p>
 *       <p>Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
 *       {error && <p className="text-red-500">{error.message}</p>}
 *       <button onClick={startListening}>Start VAD</button>
 *       <button onClick={stopListening}>Stop VAD</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkVADSupport, getVADErrorMessage } from '@/lib/voice/vad-utils';
import type { VADConfig } from '@/lib/voice/types';

// ---------------------------------------------------------------------------
// Debug helper
// ---------------------------------------------------------------------------

const DEBUG =
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_VAD_DEBUG === 'true';

function debugLog(...args: unknown[]) {
    if (DEBUG) {
        console.log('[useVAD]', ...args);
    }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options accepted by {@link useVoiceActivityDetection}. */
export interface UseVADOptions {
    /**
     * Whether VAD is enabled. When `false` the hook is completely inert —
     * no imports, no mic access, no side effects.
     * @default false
     */
    enabled?: boolean;

    /** Fired when the user starts speaking. */
    onSpeechStart?: () => void;

    /** Fired when the user stops speaking. */
    onSpeechEnd?: (audio: Float32Array) => void;

    /** Fired when an error occurs during init or listening. */
    onError?: (error: Error) => void;

    /**
     * If `true`, VAD begins listening as soon as it finishes initialising.
     * @default false
     */
    autoStart?: boolean;

    /**
     * Optional overrides for the underlying VADManager configuration.
     * Merged on top of the defaults defined in `vad-manager.ts`.
     */
    vadConfig?: Partial<VADConfig>;
}

/** Values returned by {@link useVoiceActivityDetection}. */
export interface UseVADReturn {
    /** `true` while the VAD is actively processing microphone audio. */
    isListening: boolean;

    /** `true` while the user is currently speaking (between speech-start and speech-end). */
    isSpeaking: boolean;

    /** The most recent error, or `null`. */
    error: Error | null;

    /** `true` if the browser supports all required APIs. */
    isSupported: boolean;

    /** `true` while the VADManager is loading / initialising. */
    isInitializing: boolean;

    /**
     * Start listening for voice activity.
     * Initialises the VADManager on first call (lazy load).
     */
    startListening: () => Promise<void>;

    /** Stop listening (pauses the mic stream but keeps the instance alive). */
    stopListening: () => void;
}

// ---------------------------------------------------------------------------
// No-op return (used when disabled or unsupported)
// ---------------------------------------------------------------------------

const NOOP_ASYNC = async () => { };
const NOOP = () => { };

const DISABLED_RETURN: UseVADReturn = {
    isListening: false,
    isSpeaking: false,
    error: null,
    isSupported: false,
    isInitializing: false,
    startListening: NOOP_ASYNC,
    stopListening: NOOP,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for Voice Activity Detection.
 *
 * - **Opt-in**: does nothing unless `enabled` is `true`.
 * - **Lazy**: the ~2 MB ONNX runtime is only imported on first `startListening()` (or on mount if `autoStart` is set).
 * - **Safe**: returns no-op functions on unsupported browsers.
 * - **Coexists** with the existing Web Speech API hooks — they use separate audio pipelines.
 */
export function useVoiceActivityDetection(
    options: UseVADOptions = {},
): UseVADReturn {
    const {
        enabled = false,
        onSpeechStart,
        onSpeechEnd,
        onError,
        autoStart = false,
        vadConfig,
    } = options;

    // --- State ---------------------------------------------------------------
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    // --- Refs (stable across renders) ----------------------------------------
    const managerRef = useRef<Awaited<ReturnType<typeof importManager>> | null>(null);
    const unsubsRef = useRef<Array<() => void>>([]);
    const mountedRef = useRef(true);

    // Keep callback refs fresh without re-triggering effects
    const onSpeechStartRef = useRef(onSpeechStart);
    const onSpeechEndRef = useRef(onSpeechEnd);
    const onErrorRef = useRef(onError);
    onSpeechStartRef.current = onSpeechStart;
    onSpeechEndRef.current = onSpeechEnd;
    onErrorRef.current = onError;

    // --- Browser support check (runs once) -----------------------------------
    useEffect(() => {
        setIsSupported(checkVADSupport());
    }, []);

    // --- Cleanup on unmount --------------------------------------------------
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cleanupManager();
        };

    }, []);

    // --- Auto-start ----------------------------------------------------------
    useEffect(() => {
        if (enabled && autoStart && isSupported) {
            debugLog('autoStart enabled — calling startListening()');
            startListening();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, autoStart, isSupported]);

    // --- Cleanup if disabled mid-session -------------------------------------
    useEffect(() => {
        if (!enabled && managerRef.current) {
            debugLog('disabled — cleaning up manager');
            cleanupManager();
            if (mountedRef.current) {
                setIsListening(false);
                setIsSpeaking(false);
            }
        }

    }, [enabled]);

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /** Dynamically import the manager module. */
    async function importManager() {
        const mod = await import('@/lib/voice/vad-manager');
        return mod.getVADManager();
    }

    /** Unsubscribe all VAD callbacks and destroy the manager. */
    function cleanupManager() {
        debugLog('cleanupManager');
        unsubsRef.current.forEach((fn) => fn());
        unsubsRef.current = [];

        if (managerRef.current) {
            managerRef.current.destroy().catch((err: unknown) => {
                console.error('[useVAD] Error during destroy:', err);
            });
            managerRef.current = null;
        }
    }

    /** Wire up event callbacks and store unsubscribe functions. */
    function wireCallbacks(
        manager: NonNullable<typeof managerRef.current>,
    ) {
        const unsubs: Array<() => void> = [];

        const MISFIRE_DEBOUNCE_MS = 300;
        let misfireTimer: ReturnType<typeof setTimeout> | null = null;

        unsubs.push(
            manager.onSpeechStart(() => {
                // Cancel any pending misfire reset
                if (misfireTimer) { clearTimeout(misfireTimer); misfireTimer = null; }
                debugLog('speechStart');
                if (mountedRef.current) setIsSpeaking(true);
                onSpeechStartRef.current?.();
            }),
        );

        unsubs.push(
            manager.onSpeechEnd((audio) => {
                debugLog('speechEnd');
                if (mountedRef.current) setIsSpeaking(false);
                onSpeechEndRef.current?.(audio);
            }),
        );

        unsubs.push(
            manager.onMisfire(() => {
                // Brief VAD misfire: debounce isSpeaking reset to avoid state cascade
                if (misfireTimer) clearTimeout(misfireTimer);
                misfireTimer = setTimeout(() => {
                    if (mountedRef.current) setIsSpeaking(false);
                    misfireTimer = null;
                }, MISFIRE_DEBOUNCE_MS);
            }),
        );

        // Clean up misfire timer when unsubscribing
        unsubs.push(() => {
            if (misfireTimer) { clearTimeout(misfireTimer); misfireTimer = null; }
        });

        unsubsRef.current = unsubs;
    }

    /** Handle an error: update state and notify consumer. */
    function handleError(err: unknown) {
        const error =
            err instanceof Error
                ? err
                : new Error(getVADErrorMessage(err));
        debugLog('error:', error.message);
        if (mountedRef.current) {
            setError(error);
            setIsListening(false);
            setIsSpeaking(false);
            setIsInitializing(false);
        }
        onErrorRef.current?.(error);
    }

    // -------------------------------------------------------------------------
    // Public actions
    // -------------------------------------------------------------------------

    /**
     * Initialise (if needed) and start listening.
     *
     * The first call triggers a dynamic import of `@ricky0123/vad-web`
     * (~2 MB). Subsequent calls are near-instant.
     */
    const startListening = useCallback(async () => {
        if (!enabled || !checkVADSupport()) {
            debugLog('startListening skipped (enabled=%s, supported=%s)', enabled, checkVADSupport());
            return;
        }

        try {
            // If we don't have a manager yet, create one
            if (!managerRef.current) {
                debugLog('lazy-loading VADManager');
                setIsInitializing(true);
                setError(null);

                const manager = await importManager();
                if (!mountedRef.current) return; // component unmounted during import

                await manager.init(vadConfig);
                if (!mountedRef.current) return;

                managerRef.current = manager;
                wireCallbacks(manager);
                setIsInitializing(false);
            }

            debugLog('starting');
            await managerRef.current.start();
            if (mountedRef.current) {
                setIsListening(true);
                setError(null);
            }
        } catch (err) {
            handleError(err);
        }

    }, [enabled, vadConfig]);

    /**
     * Pause listening. The mic stream is suspended but the VADManager
     * instance stays alive for quick resume.
     */
    const stopListening = useCallback(() => {
        if (!managerRef.current) return;

        debugLog('stopping');
        managerRef.current.stop().catch((err: unknown) => {
            console.error('[useVAD] Error stopping:', err);
        });

        if (mountedRef.current) {
            setIsListening(false);
            setIsSpeaking(false);
        }
    }, []);

    // -------------------------------------------------------------------------
    // Early return when disabled
    // -------------------------------------------------------------------------

    if (!enabled) {
        return DISABLED_RETURN;
    }

    return {
        isListening,
        isSpeaking,
        error,
        isSupported,
        isInitializing,
        startListening,
        stopListening,
    };
}
