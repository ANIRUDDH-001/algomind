import { useState, useEffect, useRef, useCallback } from 'react';
import { chunkTextForSpeech } from '@/lib/voice/text-chunker';
import { getProcesedVoices, findBestMatchingVoice } from '@/lib/voice/voice-utils';
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';
import { getUserPreferences } from '@/lib/supabase/user-preferences';
import { useAuth } from '@/components/auth/AuthProvider';


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
    const { user } = useAuth();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [rate, setRate] = useState(options.rate || 0.9); // Slightly slower for natural feel

    // Queue of text chunks to speak
    const queueRef = useRef<string[]>([]);
    const processingRef = useRef(false);

    // Load voices and apply preferences
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoicesAndPrefs = async () => {
                // 1. Get raw voices
                const rawVoices = window.speechSynthesis.getVoices();

                // 2. Process/Deduplicate using shared logic
                const processed = getProcesedVoices(rawVoices);
                setAvailableVoices(processed);

                if (processed.length === 0) return;

                // Don't change voice settings while actively speaking — prevents mid-sentence resets
                if (isSpeaking) return;

                // 3. Load User Preferences (Voice & Rate)
                try {
                    const prefs = await getUserPreferences(user?.id || null);

                    // Apply Speed
                    setRate(prefs.voiceRate || 0.9);

                    // Apply Voice
                    // If we have a preferred name, try to find it
                    // Otherwise fall back to best default
                    const bestVoice = findBestMatchingVoice(processed, prefs.preferredVoiceName);

                    if (bestVoice && (!currentVoice || currentVoice.name !== bestVoice.name)) {
                        // console.log("🔊 [VoiceOutput] Applied voice:", bestVoice.name, "Rate:", prefs.voiceRate);
                        setCurrentVoice(bestVoice);
                    }
                } catch (e) {
                    console.warn("Failed to load voice preferences in interview:", e);
                    // Fallback to best available
                    const best = findBestMatchingVoice(processed, null);
                    if (best) setCurrentVoice(best);
                }
            };

            // Run immediately
            updateVoicesAndPrefs();

            // And on change
            window.speechSynthesis.onvoiceschanged = updateVoicesAndPrefs;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, options.rate]); // Removed currentVoice dependency to avoid loops, relying on explicit check

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

            utterance.onend = () => {
                console.log('[VoiceOutput] onend called. Resolving promise.');
                resolve();
            };
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

        try {
            // Small delay to ensure browser audio context is ready
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
        } finally {
            setIsSpeaking(false);
            processingRef.current = false;
            if (options.onEnd) options.onEnd();
        }
    }, [speakChunk, isPaused, options]);

    const speak = useCallback((text: string) => {
        if (!text) return;

        // Clean text (remove markdown-ish artifacts)
        let cleanText = text.replace(/[*_#`]/g, '');
        cleanText = preprocessForTTS(cleanText);

        console.log('[VoiceOutput] Adding to queue:', cleanText);

        // Append to queue instead of replacing if we want natural flow,
        // but for Kai usually we want to replace current response
        window.speechSynthesis.cancel();
        queueRef.current = chunkTextForSpeech(cleanText);

        // If not already processing, start the loop
        if (!processingRef.current) {
            processQueue();
        }
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
