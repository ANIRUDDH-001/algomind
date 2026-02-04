import { useState, useEffect, useRef, useCallback } from 'react';
import { DSA_VOCABULARY } from '@/lib/voice/vocabulary';

interface VoiceInputOptions {
    language?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onTranscript?: (text: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
}

export function useVoiceInput(options: VoiceInputOptions = {}) {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSupported, setIsSupported] = useState(true);
    const [lastResultTime, setLastResultTime] = useState<number>(0);

    const recognitionRef = useRef<any>(null);
    const shouldListenRef = useRef(false);

    const {
        language = 'en-US',
        continuous = true,
        interimResults = true,
        onTranscript,
        onError
    } = options;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (!SpeechRecognition) {
                setIsSupported(false);
                setError('Browser not supported. Please use Chrome, Edge, or Safari.');
            }
        }
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported) return;

        try {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = language;
            recognition.continuous = continuous;
            recognition.interimResults = interimResults;

            const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
            if (SpeechGrammarList) {
                const speechRecognitionList = new SpeechGrammarList();
                const grammar = '#JSGF V1.0; grammar dsa; public <dsa> = ' + DSA_VOCABULARY.join(' | ') + ' ;';
                speechRecognitionList.addFromString(grammar, 1);
                recognition.grammars = speechRecognitionList;
            }

            recognition.onstart = () => {
                setIsListening(true);
                setError(null);
                setLastResultTime(Date.now());
            };

            recognition.onresult = (event: any) => {
                let finalTrans = '';
                let interimTrans = '';
                setLastResultTime(Date.now());

                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTrans += event.results[i][0].transcript;
                    } else {
                        interimTrans += event.results[i][0].transcript;
                    }
                }

                if (finalTrans) {
                    setTranscript(prev => {
                        const newTranscript = prev ? `${prev} ${finalTrans}` : finalTrans;
                        if (onTranscript) onTranscript(newTranscript, true);
                        return newTranscript;
                    });
                    setInterimTranscript('');
                }

                if (interimTrans) {
                    setInterimTranscript(interimTrans);
                    if (onTranscript) onTranscript(interimTrans, false);
                }
            };

            recognition.onerror = (event: any) => {
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
                if (onError) onError(errorMessage);
                setIsListening(false);
            };

            recognition.onend = () => {
                // Potential auto-restart if interrupted incorrectly (e.g. Chrome's 60s limit)
                if (shouldListenRef.current && continuous) {
                    setTimeout(() => {
                        try {
                            if (shouldListenRef.current) recognition.start();
                        } catch (e) {
                            console.error("Mic auto-restart failed:", e);
                        }
                    }, 300);
                } else {
                    setIsListening(false);
                }
            };

            recognition.start();
            shouldListenRef.current = true;
        } catch (e) {
            setError('Failed to start microphone.');
            setIsListening(false);
        }
    }, [isSupported, language, continuous, interimResults, onTranscript, onError]);

    const stopListening = useCallback(() => {
        shouldListenRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

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
        resetTranscript,
        isSupported,
        error,
        lastResultTime
    };
}
