'use client';
/**
 * useVAD — ONNX Silero → Push-to-talk cascade.
 * enabled=false → completely inert (no mic, no WASM load).
 * ONNX fails or WASM unsupported → silent fallback to push-to-talk.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export type VADMode = 'onnx' | 'push-to-talk';

export interface UseVADOptions {
    enabled: boolean;
    onSpeechEnd?: (audio: Float32Array) => void;
    onError?: (err: Error) => void;
}

export function useVAD(opts: UseVADOptions) {
    const [mode, setMode] = useState<VADMode>('push-to-talk');
    const [isListening, setIsListening] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const vadRef = useRef<any>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    // Detect ONNX support
    useEffect(() => {
        if (!opts.enabled) return;
        const supported =
            typeof SharedArrayBuffer !== 'undefined' &&
            typeof window !== 'undefined' &&
            !!window.AudioWorklet;
        setMode(supported ? 'onnx' : 'push-to-talk');
        if (!supported) setIsReady(true); // Push-to-talk is always ready
    }, [opts.enabled]);

    const startListening = useCallback(async () => {
        if (!opts.enabled) return;
        if (mode === 'push-to-talk') { setIsListening(true); return; }

        // ONNX: dynamic import — keeps WASM out of initial bundle
        try {
            const { MicVAD } = await import('@ricky0123/vad-web');
            if (vadRef.current) { await vadRef.current.pause(); }
            const vad = await MicVAD.new({
                onSpeechEnd: (audio: Float32Array) => optsRef.current.onSpeechEnd?.(audio),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            await vad.start();
            vadRef.current = vad;
            setIsListening(true);
            setIsReady(true);
        } catch (err) {
            const e = err instanceof Error ? err : new Error('VAD init failed');
            opts.onError?.(e);
            setMode('push-to-talk');  // Silently downgrade
            setIsListening(true);
            setIsReady(true);
        }
    }, [opts, mode]);

    const stopListening = useCallback(async () => {
        setIsListening(false);
        if (vadRef.current) {
            try { await vadRef.current.pause(); } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => () => {
        vadRef.current?.destroy?.();
    }, []);

    return { mode, isListening, isReady, startListening, stopListening };
}
