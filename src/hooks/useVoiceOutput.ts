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

export type TTSProviderStatus = 'groq' | 'browser' | 'detecting';

export function useVoiceOutput(options: VoiceOutputOptions = {}) {
    const { user } = useAuth();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [rate, setRate] = useState(options.rate || 0.9);
    const [ttsProvider, setTtsProvider] = useState<TTSProviderStatus>('detecting');
    const [currentProvider, setCurrentProvider] = useState<'groq' | 'browser'>('browser');

    // Queue of text chunks to speak (browser TTS fallback)
    const queueRef = useRef<string[]>([]);
    const processingRef = useRef(false);

    // AudioContext for Groq TTS playback
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
    // Track whether Groq TTS is available (avoids retrying after first 503)
    const groqAvailableRef = useRef<boolean | null>(null); // null = not yet probed

    // ─── Detect Groq availability on mount ─────────────────────────────

    useEffect(() => {
        if (!user) {
            setTtsProvider('browser');
            return;
        }

        let cancelled = false;

        async function detectProvider() {
            try {
                // ✅ Just check the feature flag - no API credits wasted
                const res = await fetch('/api/flags', { signal: AbortSignal.timeout(3000) });
                if (cancelled) return;

                if (res.ok) {
                    const flags = await res.json();
                    const groqEnabled = flags['ENABLE_GROQ_TTS']?.value === true;

                    if (groqEnabled) {
                        groqAvailableRef.current = true;
                        setTtsProvider('groq');
                    } else {
                        groqAvailableRef.current = false;
                        setTtsProvider('browser');
                    }
                } else {
                    groqAvailableRef.current = false;
                    setTtsProvider('browser');
                }
            } catch {
                if (!cancelled) {
                    groqAvailableRef.current = false;
                    setTtsProvider('browser');
                }
            }
        }

        detectProvider();
        return () => { cancelled = true; };
    }, [user]);

    // ─── Load browser voices and preferences (for fallback) ────────────

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoicesAndPrefs = async () => {
                const rawVoices = window.speechSynthesis.getVoices();
                const processed = getProcesedVoices(rawVoices);
                setAvailableVoices(processed);

                if (processed.length === 0) return;
                if (isSpeaking) return;

                try {
                    const prefs = await getUserPreferences(user?.id || null);
                    setRate(prefs.voiceRate || 0.9);

                    const bestVoice = findBestMatchingVoice(processed, prefs.preferredVoiceName);
                    if (bestVoice && (!currentVoice || currentVoice.name !== bestVoice.name)) {
                        setCurrentVoice(bestVoice);
                    }
                } catch (e) {
                    console.warn("Failed to load voice preferences in interview:", e);
                    const best = findBestMatchingVoice(processed, null);
                    if (best) setCurrentVoice(best);
                }
            };

            updateVoicesAndPrefs();
            window.speechSynthesis.onvoiceschanged = updateVoicesAndPrefs;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, options.rate]);

    // Cleanup AudioContext on unmount
    useEffect(() => {
        return () => {
            if (sourceNodeRef.current) {
                try { sourceNodeRef.current.stop(); } catch { /* already stopped */ }
                sourceNodeRef.current = null;
            }
            if (audioContextRef.current) {
                audioContextRef.current.close().catch(() => { /* ignore */ });
                audioContextRef.current = null;
            }
        };
    }, []);

    // ─── Groq TTS via AudioContext (primary) ───────────────────────────

    const speakWithGroq = useCallback(async (text: string): Promise<boolean> => {
        if (groqAvailableRef.current === false) return false;
        if (!user) return false;

        try {
            const response = await fetch('/api/voice/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok) {
                // Any failure (502 decommissioned, 503 disabled, 500 etc.)
                // permanently disables Groq for this session → browser fallback
                groqAvailableRef.current = false;
                setTtsProvider('browser');
                return false;
            }

            const arrayBuffer = await response.arrayBuffer();

            // Create or resume AudioContext
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContext();
            }
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            sourceNodeRef.current = source;

            return new Promise<boolean>((resolve) => {
                source.onended = () => {
                    sourceNodeRef.current = null;
                    resolve(true);
                };

                source.start(0);
            });
        } catch {
            return false;
        }
    }, [user]);

    // ─── Browser TTS (fallback) ────────────────────────────────────────

    const speakWithBrowser = useCallback((text: string) => {
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
                resolve();
            };
            utterance.onerror = (e) => {
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.error("TTS Error Detail:", e.error);
                }
                resolve();
            };

            window.speechSynthesis.speak(utterance);
        });
    }, [currentVoice, rate, options.pitch, options.volume]);

    const processQueueBrowser = useCallback(async () => {
        while (queueRef.current.length > 0) {
            if (isPaused) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const chunk = queueRef.current.shift();
            if (chunk) {
                await speakWithBrowser(chunk);
            }
        }
    }, [speakWithBrowser, isPaused]);

    // ─── Main speak function ───────────────────────────────────────────

    const speak = useCallback(async (text: string) => {
        if (!text) return;

        // Clean text (remove markdown-ish artifacts)
        let cleanText = text.replace(/[*_#`]/g, '');
        cleanText = preprocessForTTS(cleanText);

        // Cancel any in-progress speech
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch { /* already stopped */ }
            sourceNodeRef.current = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        queueRef.current = [];

        // Start speaking
        if (processingRef.current) return;
        processingRef.current = true;
        setIsSpeaking(true);
        if (options.onStart) options.onStart();

        try {
            await new Promise(r => setTimeout(r, 50));

            let success = false;

            // Try Groq TTS first if provider is 'groq'
            if (ttsProvider === 'groq') {
                success = await speakWithGroq(cleanText);
                if (success) {
                    setCurrentProvider('groq');
                }
            }

            // Try AWS Polly as middle fallback (if Groq failed/unavailable)
            if (!success) {
                try {
                    const pollyRes = await fetch('/api/voice/synthesize-polly', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: cleanText }),
                    });
                    if (pollyRes.ok) {
                        const ab = await pollyRes.arrayBuffer();
                        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                            audioContextRef.current = new AudioContext();
                        }
                        const ctx = audioContextRef.current;
                        if (ctx.state === 'suspended') await ctx.resume();
                        const buf = await ctx.decodeAudioData(ab);
                        const src = ctx.createBufferSource();
                        src.buffer = buf;
                        src.connect(ctx.destination);
                        sourceNodeRef.current = src;
                        await new Promise<void>(resolve => {
                            src.onended = () => { sourceNodeRef.current = null; resolve(); };
                            src.start(0);
                        });
                        success = true;
                    }
                } catch {
                    // Polly unavailable — fall through to browser
                }
            }

            // Final fallback: browser SpeechSynthesis
            if (!success) {
                setCurrentProvider('browser');
                queueRef.current = chunkTextForSpeech(cleanText);
                await processQueueBrowser();
            }
        } finally {
            setIsSpeaking(false);
            processingRef.current = false;
            if (options.onEnd) options.onEnd();
        }
    }, [ttsProvider, speakWithGroq, processQueueBrowser, options]);

    const pause = useCallback(() => {
        // Pause Groq AudioContext
        if (audioContextRef.current && audioContextRef.current.state === 'running') {
            audioContextRef.current.suspend().catch(() => { /* ignore */ });
        }
        // Pause browser TTS
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
        setIsPaused(true);
        if (options.onPause) options.onPause();
    }, [options]);

    const resume = useCallback(() => {
        // Resume Groq AudioContext
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().catch(() => { /* ignore */ });
        }
        // Resume browser TTS
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.resume();
        }
        setIsPaused(false);
    }, []);

    const stop = useCallback(() => {
        // Stop Groq audio
        if (sourceNodeRef.current) {
            try { sourceNodeRef.current.stop(); } catch { /* already stopped */ }
            sourceNodeRef.current = null;
        }
        if (audioContextRef.current) {
            audioContextRef.current.suspend().catch(() => { /* ignore */ });
        }
        // Stop browser TTS
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
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
        rate,
        ttsProvider,
        currentProvider,
    };
}
