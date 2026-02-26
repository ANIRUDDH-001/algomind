'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WhisperSTT } from '@/lib/voice/whisper-stt';

interface UseWhisperInputOptions {
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    enabled?: boolean;
}

export function useWhisperInput(options: UseWhisperInputOptions = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [lastResultTime, setLastResultTime] = useState(0);
    const whisperRef = useRef<WhisperSTT | null>(null);
    const shouldListenRef = useRef(false);
    const isSupported = WhisperSTT.isSupported();
    const startListeningRef = useRef<(() => Promise<void>) | undefined>(undefined);

    const onTranscriptRef = useRef(options.onTranscript);
    useEffect(() => { onTranscriptRef.current = options.onTranscript; }, [options.onTranscript]);

    // Internal restart for continuous mode
    const restartContinuous = useCallback(async () => {
        if (!shouldListenRef.current || !whisperRef.current) return;
        setIsListening(true);
        try {
            await whisperRef.current.start();
        } catch { /* Fail silently on auto-restart */ }
    }, []);

    const startListening = useCallback(async () => {
        if (!isSupported || isListening) return;

        shouldListenRef.current = true;
        setIsListening(true);
        setError(null);

        // Create new WhisperSTT instance if needed
        if (!whisperRef.current) {
            whisperRef.current = new WhisperSTT((result) => {
                if (!result.text) return;
                setTranscript(prev => prev ? `${prev} ${result.text}` : result.text);
                setLastResultTime(Date.now());
                onTranscriptRef.current?.(result.text, result.isFinal);

                // After a complete utterance, restart listening
                if (shouldListenRef.current) {
                    setTimeout(() => restartContinuous(), 100);
                }
            }, { silenceGapMs: 1500, maxDurationMs: 30000 });
        }

        try {
            await whisperRef.current.start();
        } catch {
            setError('Failed to start microphone recording');
            setIsListening(false);
        }
    }, [isSupported, isListening, restartContinuous]);
    useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        whisperRef.current?.stop();
        setIsListening(false);
    }, []);

    const abortListening = useCallback(() => {
        shouldListenRef.current = false;
        whisperRef.current?.stop();
        setIsListening(false);
        setInterimTranscript('');
    }, []);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
            whisperRef.current?.destroy();
        };
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        error,
        lastResultTime,
        isSupported,
        startListening,
        stopListening,
        abortListening,
        resetTranscript,
    };
}
