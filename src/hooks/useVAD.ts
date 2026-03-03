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
 */
import { useState, useEffect, useRef, useCallback } from 'react';

import { VADState } from '@/lib/voice/types';

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

    const managerRef = useRef<{ stop: () => Promise<void>; destroy?: () => Promise<void>; init: () => Promise<void>; start: () => Promise<void>; state: string; onSpeechEnd?: (cb: (audio: Float32Array) => void) => (() => void) } | null>(null);
    const unsubsRef = useRef<(() => void)[]>([]);
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
        if (!supported) setIsReady(true);
    }, [opts.enabled]);

    const startListening = useCallback(async () => {
        if (!opts.enabled) return;

        // Phase 3b: push-to-talk has no real mic capture — don't claim we're listening
        if (mode === 'push-to-talk') {
            setIsListening(false);
            setIsReady(true);
            return;
        }

        // ONNX mode: use vad-manager singleton
        try {
            const { getVADManager } = await import('@/lib/voice/vad-manager');
            const manager = getVADManager();
            managerRef.current = manager;

            // Register speech end callback
            const unsub = manager.onSpeechEnd?.((audio: Float32Array) => {
                optsRef.current.onSpeechEnd?.(audio);
            });
            if (unsub) unsubsRef.current.push(unsub);

            if (manager.state === VADState.IDLE) {
                await manager.init();
            }
            await manager.start();
            setIsListening(true);
            setIsReady(true);
        } catch (err) {
            const e = err instanceof Error ? err : new Error('VAD init failed');
            opts.onError?.(e);
            // Silently downgrade to push-to-talk
            setMode('push-to-talk');
            // Phase 3b: Honest — don't fake isListening
            setIsListening(false);
            setIsReady(true);
        }
    }, [opts, mode]);

    const stopListening = useCallback(async () => {
        setIsListening(false);
        if (managerRef.current) {
            try { await managerRef.current.stop(); } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => () => {
        // Cleanup subscriptions
        unsubsRef.current.forEach(fn => fn());
        unsubsRef.current = [];
        if (managerRef.current) {
            try { managerRef.current.destroy?.(); } catch { /* ignore */ }
        }
    }, []);

    return { mode, isListening, isReady, startListening, stopListening };
}
