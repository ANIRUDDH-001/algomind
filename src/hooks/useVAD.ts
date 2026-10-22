/**
 * @codesage
 * @file      src/hooks/useVAD.ts
 * @purpose   React wrapper around MicController (the single owner of mic + Silero VAD), falling back to push-to-talk.
 * @tech      React
 * @connects  MicController + createBrowserVad (lib/voice/mic-controller); used by useInterview, useUnifiedVoice
 * @apis      none
 * @db        none
 * @state     Mirrors MicController status; support detection
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';
import { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from 'react';

import { MicController, createBrowserVad, type MicStatus } from '@/lib/voice/mic-controller';

export type VADMode = 'onnx' | 'push-to-talk';

export interface UseVADOptions {
    enabled: boolean;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onError?: (err: Error) => void;
    /** Called once when VAD degrades to push-to-talk — parent should cascade to browser STT */
    onFallback?: () => void;
    /** Called each frame with the raw Silero speech probability (0–1) for visualizers. */
    onFrameProcessed?: (prob: number) => void;
    /** Speech started but was too short to count (cough, click) — no onSpeechEnd follows. */
    onMisfire?: () => void;
    /** Every MicController status change (voice telemetry reports 'recovering' / 'failed'). */
    onStatus?: (status: MicStatus, detail?: string) => void;
}

function browserSupportsVad(): boolean {
    // SharedArrayBuffer is NOT required — the vad-bundle UMD build works without it.
    return typeof window !== 'undefined' &&
        !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) &&
        !!navigator?.mediaDevices?.getUserMedia &&
        typeof WebAssembly !== 'undefined';
}
const noSubscribe = () => () => {};

export function useVAD(opts: UseVADOptions) {
    const optsRef = useRef(opts);
    const enabledRef = useRef(opts.enabled);
    // Latest handlers for the controller's async callbacks (VAD events always fire after commit).
    useEffect(() => {
        optsRef.current = opts;
        enabledRef.current = opts.enabled;
    });

    const [status, setStatus] = useState<MicStatus>('off');
    // Browser capability never changes; null on the server keeps hydration consistent.
    const supported = useSyncExternalStore<boolean | null>(noSubscribe, browserSupportsVad, () => null);
    const fallbackFiredRef = useRef(false);
    const micRef = useRef<MicController | null>(null);

    const fireFallback = useCallback((err?: Error) => {
        if (err) optsRef.current.onError?.(err);
        if (fallbackFiredRef.current) return;
        fallbackFiredRef.current = true;
        optsRef.current.onFallback?.();
    }, []);

    /** One controller per hook instance, created on first use (never during render). */
    const getMic = useCallback((): MicController => {
        if (!micRef.current) {
            micRef.current = new MicController({
                createVad: createBrowserVad,
                onStatus: (s, detail) => {
                    setStatus(s);
                    optsRef.current.onStatus?.(s, detail);
                    if (s === 'failed') fireFallback(new Error(detail || 'Microphone / VAD unavailable'));
                },
                onSpeechStart: () => optsRef.current.onSpeechStart?.(),
                onSpeechEnd: (audio) => optsRef.current.onSpeechEnd?.(audio),
                onFrame: (prob) => optsRef.current.onFrameProcessed?.(prob),
                onMisfire: () => optsRef.current.onMisfire?.(),
            });
        }
        return micRef.current;
    }, [fireFallback]);

    const startListening = useCallback(async () => {
        if (!enabledRef.current) return;
        if (!browserSupportsVad()) {
            console.warn('[useVAD] Browser lacks AudioContext/getUserMedia/WebAssembly. Using push-to-talk.');
            fireFallback(); // not an error — the parent cascades to push-to-talk / browser STT
            return;
        }
        await getMic().setIntent('listen');
    }, [getMic, fireFallback]);

    // `force` is kept for API compatibility: pausing always delivers the in-flight utterance
    // (vad-web submitUserSpeechOnPause), so there is no deferred stop any more.
    const stopListening = useCallback(async (_force = false) => { await micRef.current?.setIntent('off'); }, []);

    const poke = useCallback(async (reason: string) => { await micRef.current?.poke(reason); }, []);

    // A plugged / unplugged microphone gets a fresh VAD instead of a dead stream.
    useEffect(() => {
        const devices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
        if (!devices?.addEventListener) return;
        const onDeviceChange = () => { void micRef.current?.poke('devicechange'); };
        devices.addEventListener('devicechange', onDeviceChange);
        return () => devices.removeEventListener('devicechange', onDeviceChange);
    }, []);

    useEffect(() => () => { void micRef.current?.dispose(); }, []);

    const mode: VADMode = opts.enabled && supported === true && status !== 'failed' ? 'onnx' : 'push-to-talk';
    const isListening = status === 'listening';
    // "Ready" = not busy initialising. A disabled VAD (browser STT) has nothing to initialise,
    // so the mic button must not sit on "Initializing…".
    const isReady = !opts.enabled || supported === false || (status !== 'starting' && status !== 'recovering');

    // Memoized: consumers put the returned object in effect deps.
    return useMemo(
        () => ({ mode, isListening, isReady, status, startListening, stopListening, poke }),
        [mode, isListening, isReady, status, startListening, stopListening, poke],
    );
}
