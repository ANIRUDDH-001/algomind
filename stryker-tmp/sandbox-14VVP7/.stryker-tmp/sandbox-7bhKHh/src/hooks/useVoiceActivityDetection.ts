/**
 * @codesage
 * @file      src/hooks/useVoiceActivityDetection.ts
 * @purpose   Alternative lightweight hook wrapping VADManager for components needing basic speech events.
 * @tech      React
 * @connects  Imports VADManager; Used by ConversationView and similar components
 * @apis      none
 * @db        none
 * @state     React component state for listening/error
 * @env       none
 * @issues    Duplicates some functionality of useVAD; check for consolidation.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';
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
                    console.log('[useVoiceActivityDetection] Initializing VADManager...');
                    await manager.init();
                }
                if (cancelled) return;

                console.log('[useVoiceActivityDetection] Registering callbacks. State:', manager.state);

                unsubs.push(manager.onSpeechStart(() => {
                    optsRef.current.onSpeechStart?.();
                }));

                unsubs.push(manager.onSpeechEnd((audio) => {
                    optsRef.current.onSpeechEnd?.(audio);
                }));

                if (opts.autoStart && (manager.state === VADState.PAUSED || manager.state === VADState.LISTENING)) {
                    if (manager.state !== VADState.LISTENING) {
                        await manager.start();
                    }
                    if (!cancelled) {
                        setIsListening(true);
                        console.log('[useVoiceActivityDetection] VAD listening ✓');
                    }
                }
            } catch (err) {
                if (cancelled) return;
                const e = err instanceof Error ? err : new Error('VAD init failed');
                console.error('[useVoiceActivityDetection] Init failed:', e.message);
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
