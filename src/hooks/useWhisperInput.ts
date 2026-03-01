'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { WhisperSTT } from '@/lib/voice/whisper-stt';

interface UseWhisperInputOptions {
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    enabled?: boolean;
}

export function useWhisperInput(options: UseWhisperInputOptions = {}) {
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [interimTranscript, setInterimTranscript] = useState('');
    const [lastResultTime, setLastResultTime] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const whisperRef = useRef<WhisperSTT | null>(null);
    const shouldListenRef = useRef(false);
    const isSupported = WhisperSTT.isSupported();

    const onTranscriptRef = useRef(options.onTranscript);
    useEffect(() => { onTranscriptRef.current = options.onTranscript; }, [options.onTranscript]);

    useEffect(() => {
        if (!whisperRef.current) {
            whisperRef.current = new WhisperSTT((result) => {
                if (!result.text) return;
                setTranscript(prev => prev ? `${prev} ${result.text}` : result.text);
                setLastResultTime(Date.now());
                onTranscriptRef.current?.(result.text, result.isFinal);
            });
        }
    }, []);

    const transcribeVADAudio = useCallback(async (audio: Float32Array) => {
        if (!isSupported || !whisperRef.current) return;

        setError(null);
        setLastResultTime(Date.now());

        try {
            await whisperRef.current.transcribeVADAudio(audio);
        } catch {
            setError('Failed to transcribe audio');
        }
    }, [isSupported]);

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    // startListening: signals the hook consumer that VAD is armed
    const startListening = useCallback(() => {
        setIsActive(true);
        console.warn('[useWhisperInput] startListening called — VAD manages the audio stream, not Whisper directly');
    }, []);

    // stopListening: disarms VAD expectation and clears pending transcript
    const stopListening = useCallback(() => {
        setIsActive(false);
        clearTranscript();
    }, [clearTranscript]);

    // abortListening: same as stop but semantically indicates cancellation
    const abortListening = useCallback(() => {
        setIsActive(false);
        clearTranscript();
    }, [clearTranscript]);

    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
        };
    }, []);

    return {
        // VAD-triggered mode: VAD owns the audio stream, Whisper is never "listening" continuously.
        // isListening is always false — the Send button logic must NOT gate on this in Whisper mode.
        isListening: false,
        isActive,                  // true when VAD is armed and Whisper transcription is expected
        startListening,
        stopListening,
        abortListening,
        transcript,
        interimTranscript,         // Always '' in Whisper mode (no streaming partial results)
        error,
        lastResultTime,
        isSupported,
        resetTranscript: clearTranscript,
        transcribeVADAudio,
    };
}
