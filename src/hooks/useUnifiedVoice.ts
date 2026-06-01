/**
 * @codesage
 * @file      src/hooks/useUnifiedVoice.ts
 * @purpose   Consolidates TTS, STT, and VAD into a single manageable React hook.
 * @tech      React
 * @connects  Composes useVAD, useSTT, useTTS; alternative to useInterviewVoice
 * @apis      none
 * @db        none
 * @state     Unified state machine for voice (idle, listening, processing, speaking, error)
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useVAD, type VADMode } from './useVAD';
import { useSTT, type STTProvider, type ResolvedSTTProvider } from './useSTT';
import { useTTS } from './useTTS';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface UseUnifiedVoiceOptions {
    sttProvider?: STTProvider;
    language?: string;
    silenceMs?: number;
    enabled?: boolean;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onSpeechStart?: () => void;
    onSpeechEnd?: (audio: Float32Array) => void;
    onSilenceTimeout?: () => void;
    onError?: (err: Error | string) => void;
    onEmpty?: () => void;
}

export function useUnifiedVoice(opts: UseUnifiedVoiceOptions = {}) {
    const {
        sttProvider = 'whisper',
        language = 'en-US',
        silenceMs = 5000,
        enabled = true,
    } = opts;

    const [state, setState] = useState<VoiceState>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const stateRef = useRef<VoiceState>('idle');
    const updateState = useCallback((newState: VoiceState) => {
        if (stateRef.current === newState) return;
        stateRef.current = newState;
        setState(newState);
    }, []);

    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    // TTS
    const tts = useTTS({
        onSpeakStart: () => {
            updateState('speaking');
        },
        onSpeakEnd: () => {
            if (stateRef.current === 'speaking') {
                updateState('idle');
                // Automatically resume listening if enabled
                if (optsRef.current.enabled) {
                    start();
                }
            }
        }
    });

    // STT
    const stt = useSTT({
        provider: sttProvider,
        language,
        silenceMs,
        onTranscript: (text, isFinal) => {
            if (isFinal) {
                updateState('processing');
            }
            optsRef.current.onTranscript?.(text, isFinal);
        },
        onSilenceTimeout: () => {
            optsRef.current.onSilenceTimeout?.();
        },
        onError: (err) => {
            updateState('error');
            setErrorMsg(err);
            optsRef.current.onError?.(err);
        },
        onEmpty: () => {
            updateState('idle');
            optsRef.current.onEmpty?.();
        }
    });

    // VAD
    const vad = useVAD({
        enabled,
        onSpeechStart: () => {
            optsRef.current.onSpeechStart?.();
        },
        onSpeechEnd: (audio) => {
            updateState('processing');
            stt.transcribeAudio(audio);
            optsRef.current.onSpeechEnd?.(audio);
        },
        onError: (err) => {
            updateState('error');
            setErrorMsg(err.message);
            optsRef.current.onError?.(err);
        },
        onFallback: () => {
            // VAD failed, fallback to STT provider
            if (stateRef.current === 'listening') {
                stt.startListening();
            }
        }
    });

    const start = useCallback(() => {
        if (!enabled) return;
        if (stateRef.current === 'listening' || stateRef.current === 'speaking') return;
        
        setErrorMsg(null);
        updateState('listening');
        tts.stop();
        stt.resetTranscript();

        if (vad.mode === 'onnx') {
            vad.startListening();
        } else {
            stt.startListening();
        }
    }, [enabled, vad, stt, tts, updateState]);

    const stop = useCallback((force = false) => {
        updateState('idle');
        vad.stopListening(force);
        stt.stopListening();
        tts.stop();
    }, [vad, stt, tts, updateState]);

    const speak = useCallback(async (text: string) => {
        updateState('speaking');
        // Stop listening while speaking to prevent echo
        vad.stopListening(true);
        stt.stopListening();
        await tts.speak(text);
    }, [tts, vad, stt, updateState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            vad.stopListening(true);
            stt.stopListening();
            tts.stop();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        state,
        errorMsg,
        start,
        stop,
        speak,
        transcript: stt.transcript,
        interimTranscript: stt.interimTranscript,
        resetTranscript: stt.resetTranscript,
        vadMode: vad.mode,
        sttProvider: stt.resolvedProvider,
    };
}
