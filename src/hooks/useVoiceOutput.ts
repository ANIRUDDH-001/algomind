import { useState, useEffect, useRef, useCallback } from 'react';
import { chunkTextForSpeech } from '@/lib/voice/text-chunker';

interface VoiceOutputOptions {
    voice?: SpeechSynthesisVoice;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onPause?: () => void;
}

export function useVoiceOutput(options: VoiceOutputOptions = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [rate, setRate] = useState(options.rate || 1.1); // Slightly faster for natural feel

    // Queue of text chunks to speak
    const queueRef = useRef<string[]>([]);
    const processingRef = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                setAvailableVoices(voices);

                // Priority 1: User's saved preference (if provided)
                // Priority 2: English voices (to avoid Hindi number pronunciation)
                // Priority 3: Hindi as fallback option
                const preferred = voices.find(v =>
                    v.name.includes("Google US English")
                ) || voices.find(v =>
                    v.name.includes("Microsoft Zira") ||
                    v.name.includes("Samantha") ||
                    v.name.includes("Microsoft David")
                ) || voices.find(v =>
                    v.lang.startsWith('en-') && v.name.includes('Google')
                ) || voices.find(v =>
                    v.lang.startsWith('en-US')
                ) || voices.find(v =>
                    v.lang.startsWith('en-')
                ) || voices.find(v =>
                    // Hindi as last resort option
                    v.lang.startsWith('hi') || v.name.includes('Hindi')
                );

                if (preferred && !currentVoice) {
                    console.log("Selected Voice:", preferred.name, preferred.lang);
                    setCurrentVoice(preferred);
                }
            };

            updateVoices();
            window.speechSynthesis.onvoiceschanged = updateVoices;
        }
    }, [currentVoice]);

    const speakChunk = useCallback((text: string) => {
        return new Promise<void>((resolve) => {
            if (!window.speechSynthesis) {
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(text);
            if (currentVoice) utterance.voice = currentVoice;
            utterance.rate = rate;
            utterance.pitch = options.pitch || 1.0;
            utterance.volume = options.volume || 1.0;

            utterance.onend = () => resolve();
            utterance.onerror = (e) => {
                // Ignore standard interruption/cancellation errors that occur when stopping or skipping
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error("TTS Error Detail:", e.error);
                }
                resolve(); // Resolve anyway to continue or finish queue
            };

            window.speechSynthesis.speak(utterance);
        });
    }, [currentVoice, rate, options.pitch, options.volume]);

    const processQueue = useCallback(async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        setIsSpeaking(true);

        if (options.onStart) options.onStart();

        // Small delay to ensure browser audio context is ready after state changes
        await new Promise(r => setTimeout(r, 50));

        while (queueRef.current.length > 0) {
            if (isPaused) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const chunk = queueRef.current.shift();
            if (chunk) {
                await speakChunk(chunk);
            }
        }

        setIsSpeaking(false);
        processingRef.current = false;
        if (options.onEnd) options.onEnd();

    }, [speakChunk, isPaused, options]);

    const speak = useCallback((text: string) => {
        if (!text) return;

        console.log('🔊 [TTS] Starting speech:', text.substring(0, 50) + '...');

        // Clean text (remove markdown-ish artifacts if any)
        const cleanText = text.replace(/[*_#`]/g, '');

        window.speechSynthesis.cancel();
        queueRef.current = chunkTextForSpeech(cleanText);

        processingRef.current = false;
        processQueue();
    }, [processQueue]);

    const pause = useCallback(() => {
        window.speechSynthesis.pause();
        setIsPaused(true);
        if (options.onPause) options.onPause();
    }, [options]);

    const resume = useCallback(() => {
        window.speechSynthesis.resume();
        setIsPaused(false);
    }, []);

    const stop = useCallback(() => {
        console.log('🛑 [TTS] User interrupted - stopping speech');
        window.speechSynthesis.cancel();
        queueRef.current = [];
        setIsSpeaking(false);
        setIsPaused(false);
        processingRef.current = false;
    }, []);

    return {
        speak,
        pause,
        resume,
        stop,
        isSpeaking,
        isPaused,
        availableVoices,
        currentVoice,
        setVoice: setCurrentVoice,
        setRate,
        rate
    };
}
