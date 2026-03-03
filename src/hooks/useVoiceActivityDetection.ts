'use client';
/**
 * useVoiceActivityDetection — Phase 4a hook.
 *
 * Wraps the VADManager singleton from vad-manager.ts for use in
 * ConversationView and other components that need speech detection events.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getVADManager } from '@/lib/voice/vad-manager';
import { VADState } from '@/lib/voice/types';

interface UseVoiceActivityDetectionOptions {
    enabled: boolean;
    autoStart?: boolean;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onError?: (err: Error) => void;
}

export function useVoiceActivityDetection(opts: UseVoiceActivityDetectionOptions) {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    useEffect(() => {
        if (!opts.enabled) return;

        const manager = getVADManager();
        const unsubs: (() => void)[] = [];
        let cancelled = false;

        (async () => {
            try {
                if (manager.state === VADState.IDLE) {
                    await manager.init();
                }
                if (cancelled) return;

                unsubs.push(manager.onSpeechStart(() => {
                    optsRef.current.onSpeechStart?.();
                }));

                unsubs.push(manager.onSpeechEnd((audio) => {
                    optsRef.current.onSpeechEnd?.(audio);
                }));

                if (opts.autoStart && manager.state === VADState.PAUSED) {
                    await manager.start();
                    if (!cancelled) setIsListening(true);
                }
            } catch (err) {
                if (cancelled) return;
                const e = err instanceof Error ? err : new Error('VAD init failed');
                setError(e);
                optsRef.current.onError?.(e);
            }
        })();

        return () => {
            cancelled = true;
            unsubs.forEach(fn => fn());
        };
    }, [opts.enabled, opts.autoStart]);

    const start = useCallback(async () => {
        try {
            const manager = getVADManager();
            await manager.start();
            setIsListening(true);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('VAD start failed'));
        }
    }, []);

    const stop = useCallback(async () => {
        try {
            const manager = getVADManager();
            await manager.stop();
            setIsListening(false);
        } catch { /* ignore */ }
    }, []);

    return { isListening, error, start, stop };
}
