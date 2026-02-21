/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from 'react';
import { DSA_VOCABULARY } from '@/lib/voice/vocabulary';

interface VoiceInputOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
}

// Web Speech API Types (to avoid 'any')
interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    grammars: SpeechGrammarList;
    onstart: (event: Event) => void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: (event: Event) => void;
    start(): void;
    stop(): void;
    abort(): void;
}

interface SpeechGrammarList {
    addFromString(grammar: string, weight?: number): void;
}

export function useVoiceInput(options: VoiceInputOptions = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [lastResultTime, setLastResultTime] = useState<number>(0);

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const shouldListenRef = useRef(false);
    const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const {
        language = 'en-US',
        continuous = true,
        interimResults = true,
        onTranscript,
        onError
    } = options;

    const onTranscriptRef = useRef(onTranscript);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onTranscriptRef.current = onTranscript;
        onErrorRef.current = onError;
    }, [onTranscript, onError]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setTimeout(() => {
                    setIsSupported(false);
                    setError('Browser not supported. Please use Chrome, Edge, or Safari.');
                }, 0);
            }
        }

        // Cleanup on unmount
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current = null;
            }
            if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
        };
    }, []);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);

        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch { } // Ignore errors
        }
        setIsListening(false);
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported) return;
        if (isListening) return; // Prevent double start

        try {
            // Stop existing if any
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch { }
            }

            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = language;
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;

            // Grammar (optional, depends on browser support)
            const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
            if (SpeechGrammarList) {
                try {
                    const speechRecognitionList = new SpeechGrammarList();
                    const grammar = '#JSGF V1.0; grammar dsa; public <dsa> = ' + DSA_VOCABULARY.join(' | ') + ' ;';
                    speechRecognitionList.addFromString(grammar, 1);
                    recognition.grammars = speechRecognitionList;
                } catch {
                    // Ignore grammar errors
                }
            }

            recognition.onstart = () => {
                setIsListening(true);
                setError(null);
                setLastResultTime(Date.now());

                // MAX LIMIT: 60 Seconds (increased for longer explanations)
                if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
                maxTimeoutRef.current = setTimeout(() => {
                    console.log("Mic timeout reached (60s). Stopping...");
                    stopListening();
                }, 60000);
            };

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTrans = '';
                let interimTrans = '';
                setLastResultTime(Date.now());

                const results = event.results as unknown as SpeechRecognitionResultList;
                for (let i = event.resultIndex; i < results.length; ++i) {
                    if (results[i].isFinal) {
                        finalTrans += results[i][0].transcript;
                    } else {
                        interimTrans += results[i][0].transcript;
                    }
                }

                if (finalTrans) {
                    setTranscript(prev => {
                        const newTranscript = prev ? `${prev} ${finalTrans}` : finalTrans;
                        if (onTranscriptRef.current) onTranscriptRef.current(newTranscript, true);
                        return newTranscript;
                    });
                    setInterimTranscript('');
                }

                if (interimTrans) {
                    setInterimTranscript(interimTrans);
                    if (onTranscriptRef.current) onTranscriptRef.current(interimTrans, false);
                }
            };

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                if (event.error === 'no-speech') return;

                let errorMessage = `Error: ${event.error}`;
                switch (event.error) {
                    case 'audio-capture':
                        errorMessage = 'Microphone busy or not found.';
                        break;
                    case 'not-allowed':
                        errorMessage = 'Microphone access denied.';
                        break;
                    case 'network':
                        errorMessage = 'Network error during recognition.';
                        break;
                }

                setError(errorMessage);
                if (onErrorRef.current) onErrorRef.current(errorMessage);
                setIsListening(false);
            };

            recognition.onend = () => {
                setIsListening(false);
                if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);

                // Auto-restart logic handled by shouldListenRef in parent or here
                // Note: We removed the aggressive auto-restart here to let useInterview control it
                // via state. BUT if "continuous" is true, we might want to restart?
                // Actually, relies on the `useEffect` in useInterview to restart it if needed.
                // WE REMOVED THE INTERNAL AUTO-RESTART LOOP to avoid zombies.
            };

            recognition.start();
            shouldListenRef.current = true;
        } catch {
            setError('Failed to start microphone.');
            setIsListening(false);
        }
    }, [isSupported, language, continuous, interimResults, isListening, stopListening]);


    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        abortListening: useCallback(() => {
            shouldListenRef.current = false;
            if (maxTimeoutRef.current) clearTimeout(maxTimeoutRef.current);
            if (recognitionRef.current) {
                try { recognitionRef.current.abort(); } catch { }
            }
            setIsListening(false);
            setTranscript('');
            setInterimTranscript('');
        }, []),
        resetTranscript,
        isSupported,
        error,
        lastResultTime
    };
}
