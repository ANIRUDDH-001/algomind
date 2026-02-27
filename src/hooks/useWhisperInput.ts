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
    const whisperRef = useRef<WhisperSTT | null>(null);
    const shouldListenRef = useRef(false);
    const isSupported = WhisperSTT.isSupported();
    const startListeningRef = useRef<(() => Promise<void>) | undefined>(undefined);

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

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    useEffect(() => {
        return () => {
            shouldListenRef.current = false;
        };
    }, []);

    return {
        isListening: false,
        stopListening: () => { },
        startListening: () => { },
        abortListening: () => { },
        transcript,
        interimTranscript,
        error,
        lastResultTime,
        isSupported,
        resetTranscript: clearTranscript,
        transcribeVADAudio,
    };
}
