'use client';
/**
 * useVAD — Wrapper around VADManager singleton (vad-manager.ts).
 *
 * Phase 4c: Deprecates the @ricky0123/vad-web dynamic import.
 * Uses the script-tag singleton pattern from vad-manager.ts instead.
 *
 * Cascade:
 *   1. ONNX Silero VAD (via vad-manager.ts) — if device supports WASM + SharedArrayBuffer
 *   2. Push-to-talk fallback — no VAD, user controls mic manually
 *
 * Phase 3b: push-to-talk no longer fakes isListening = true.
 *
 * FIX: onSpeechEnd callback is registered once in a setup effect (not in startListening),
 *      preventing duplicate subscriptions. VAD failure triggers onFallback callback
 *      so useInterview can cascade to browser SpeechRecognition.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

import { VADState } from '@/lib/voice/types';

export type VADMode = 'onnx' | 'push-to-talk';

export interface UseVADOptions {
    enabled: boolean;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onError?: (err: Error) => void;
    /** Called when VAD degrades to push-to-talk — parent should cascade to browser STT */
    onFallback?: () => void;
}

export function useVAD(opts: UseVADOptions) {
    const [mode, setMode] = useState<VADMode>('push-to-talk');
    const [isListening, setIsListening] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [initAttempted, setInitAttempted] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const managerRef = useRef<any>(null);
    const unsubRef = useRef<(() => void) | null>(null);
    const optsRef = useRef(opts);
    // Synchronous update during render — eliminates timing gap between
    // render and useEffect that could cause stale callbacks in onSpeechEnd.
    optsRef.current = opts;

    // Pending-stop: set true when stopListening is called while VAD is still
    // capturing audio (LISTENING state). The stop is deferred until the
    // current onSpeechEnd fires so the audio buffer isn't discarded.
    const pendingStopRef = useRef(false);
    const stopFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Detect basic browser support on mount.
    // NOTE: SharedArrayBuffer is NOT required — the vad-bundle.min.js UMD build
    // handles its own polyfills and works without it (confirmed in production).
    // Only AudioContext + getUserMedia + WebAssembly are truly required.
    const onnxSupported = useRef(false);
    useEffect(() => {
        if (!opts.enabled) return;
        const supported =
            typeof window !== 'undefined' &&
            !!(window.AudioContext || (window as any).webkitAudioContext) &&
            !!navigator?.mediaDevices?.getUserMedia &&
            typeof WebAssembly !== 'undefined';
        onnxSupported.current = supported;
        if (supported) {
            setMode('onnx');
            console.log('[useVAD] Browser supports ONNX VAD (AudioContext + getUserMedia + WebAssembly)');
        } else {
            console.warn('[useVAD] Browser lacks AudioContext/getUserMedia/WebAssembly. Using push-to-talk.');
            setMode('push-to-talk');
            setIsReady(true);
        }
    }, [opts.enabled]);

    // Register callbacks ONCE when manager is available, not in startListening.
    // This prevents duplicate subscriptions when startListening is called multiple times.
    const registerCallback = useCallback((manager: {
        onSpeechStart?: (cb: () => void) => (() => void);
        onSpeechEnd?: (cb: (audio: Float32Array) => void) => (() => void);
    }) => {
        // Unsubscribe previous if any
        if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
        }
        const unsubs: (() => void)[] = [];

        const unsubStart = manager.onSpeechStart?.(() => {
            optsRef.current.onSpeechStart?.();
        });
        if (unsubStart) unsubs.push(unsubStart);

        const unsubEnd = manager.onSpeechEnd?.((audio: Float32Array) => {
            optsRef.current.onSpeechEnd?.(audio);
            // If stopListening was called while this segment was in-flight,
            // now that the audio has been delivered, execute the deferred stop.
            if (pendingStopRef.current) {
                pendingStopRef.current = false;
                if (stopFallbackTimerRef.current) {
                    clearTimeout(stopFallbackTimerRef.current);
                    stopFallbackTimerRef.current = null;
                }
                managerRef.current?.stop().catch(() => { /* ignore */ });
            }
        });
        if (unsubEnd) unsubs.push(unsubEnd);

        unsubRef.current = () => unsubs.forEach(fn => fn());
    }, []);

    const startListening = useCallback(async () => {
        if (!opts.enabled) {
            console.log('[useVAD] Not enabled, skipping startListening');
            return;
        }

        // If ONNX not supported or already failed, don't retry
        if (!onnxSupported.current || (initAttempted && mode === 'push-to-talk')) {
            console.log(`[useVAD] Skipping startListening: onnxSupported=${onnxSupported.current}, mode=${mode}`);
            setIsListening(false);
            setIsReady(true);
            // Notify parent to fall back to browser STT
            optsRef.current.onFallback?.();
            return;
        }

        // ONNX mode: use vad-manager singleton
        try {
            console.log('[useVAD] Starting ONNX VAD...');
            const { getVADManager } = await import('@/lib/voice/vad-manager');
            const manager = getVADManager();
            managerRef.current = manager;

            // Register callback once (idempotent — cleans up previous)
            registerCallback(manager);

            if (manager.state === VADState.IDLE) {
                console.log('[useVAD] VADManager in IDLE state, initializing...');
                setInitAttempted(true);
                await manager.init();
                console.log('[useVAD] VADManager initialized, state:', manager.state);
            }

            if (manager.state === VADState.PAUSED || manager.state === VADState.LISTENING) {
                if (manager.state !== VADState.LISTENING) {
                    await manager.start();
                }
                setIsListening(true);
                setIsReady(true);
                console.log('[useVAD] ONNX VAD listening ✓');
            } else {
                throw new Error(`Unexpected VAD state after init: ${manager.state}`);
            }
        } catch (err) {
            const e = err instanceof Error ? err : new Error('VAD init failed');
            console.error('[useVAD] ONNX VAD failed:', e.message);
            opts.onError?.(e);
            // Downgrade to push-to-talk
            setMode('push-to-talk');
            setIsListening(false);
            setIsReady(true);
            setInitAttempted(true);
            // Notify parent to fall back to browser STT
            optsRef.current.onFallback?.();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts.enabled, mode, initAttempted, registerCallback]);

    const stopListening = useCallback(async () => {
        setIsListening(false);
        if (!managerRef.current) return;

        // If VAD is actively listening, defer the hardware stop until the
        // current speech segment ends so onSpeechEnd can fire and Whisper
        // can transcribe the captured audio (fixes the mid-utterance discard bug).
        if (managerRef.current.state === VADState.LISTENING) {
            pendingStopRef.current = true;
            // Safety fallback: force-stop after 2s if onSpeechEnd never fires
            if (stopFallbackTimerRef.current) clearTimeout(stopFallbackTimerRef.current);
            stopFallbackTimerRef.current = setTimeout(async () => {
                if (pendingStopRef.current) {
                    pendingStopRef.current = false;
                    try { await managerRef.current?.stop(); } catch { /* ignore */ }
                }
            }, 2000);
        } else {
            try { await managerRef.current.stop(); } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => () => {
        // Cleanup subscription
        if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
        }
        if (stopFallbackTimerRef.current) {
            clearTimeout(stopFallbackTimerRef.current);
            stopFallbackTimerRef.current = null;
        }
        pendingStopRef.current = false;
        if (managerRef.current) {
            try { managerRef.current.destroy?.(); } catch { /* ignore */ }
        }
    }, []);

    return { mode, isListening, isReady, startListening, stopListening };
}
