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

export type TTSProviderStatus = 'polly' | 'groq' | 'browser' | 'detecting';

const _prefsCache = new Map<string, {
    preferredVoiceName: string | null;
    preferredVoiceLang: string;
    voiceRate: number;
}>();

export function useVoiceOutput(options: VoiceOutputOptions = {}) {
    const { user } = useAuth();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [currentVoice, setCurrentVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [rate, setRate] = useState(options.rate || 0.9);
    const [ttsProvider, setTtsProvider] = useState<TTSProviderStatus>('detecting');
    const [currentProvider, setCurrentProvider] = useState<'polly' | 'groq' | 'browser'>('browser');
    const ttsProviderRef = useRef(ttsProvider);
    useEffect(() => { ttsProviderRef.current = ttsProvider; }, [ttsProvider]);

    // Queue of text chunks to speak (browser TTS fallback)
    const queueRef = useRef<string[]>([]);
    const processingRef = useRef(false);
    const isPausedRef = useRef(false);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

    // <audio> element for Groq/Polly TTS playback (routes to media volume on iOS)
    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    // Track whether Groq TTS is available (avoids retrying after first 503)
    const groqAvailableRef = useRef<boolean | null>(null); // null = not yet probed

    const speakInvocationRef = useRef(0);

    // ─── Detect Groq availability on mount ─────────────────────────────

    useEffect(() => {
        if (!user) {
            setTtsProvider('browser');
            return;
        }
        let cancelled = false;

        async function detectProvider() {
            try {
                const res = await fetch('/api/flags', { signal: AbortSignal.timeout(3000) });
                if (cancelled || !res.ok) { setTtsProvider('browser'); return; }
                const flags = await res.json();

                const pollyEnabled = flags['ENABLE_AWS_POLLY_TTS']?.value === true;
                const groqEnabled = flags['ENABLE_GROQ_TTS']?.value === true;

                if (pollyEnabled) {
                    setTtsProvider('polly');
                } else if (groqEnabled) {
                    setTtsProvider('groq');
                } else {
                    setTtsProvider('browser');
                }
            } catch {
                if (!cancelled) setTtsProvider('browser');
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
                    const cacheKey = user?.id || 'anonymous';
                    let prefs;
                    if (_prefsCache.has(cacheKey)) {
                        prefs = _prefsCache.get(cacheKey)!;
                    } else {
                        prefs = await getUserPreferences(user?.id || null);
                        _prefsCache.set(cacheKey, prefs);
                    }

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

    // Cleanup audio element on unmount
    useEffect(() => {
        return () => {
            // ✅ Cleanup audio element on unmount
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                if (audioElementRef.current.src?.startsWith('blob:')) {
                    URL.revokeObjectURL(audioElementRef.current.src);
                }
                audioElementRef.current = null;
            }
        };
    }, []);

    // ─── AWS Polly TTS (primary) ───────────────────────────────────────

    const speakWithPolly = useCallback(async (text: string): Promise<boolean> => {
        if (!user) return false;

        const currentInvId = speakInvocationRef.current;

        try {
            const response = await fetch('/api/voice/synthesize-polly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            if (!response.ok || speakInvocationRef.current !== currentInvId) {
                if (response.status === 503) {
                    // Polly disabled or not integrated — mark unavailable
                    setTtsProvider(prev => prev === 'polly' ? 'groq' : prev);
                }
                return false;
            }
            const arrayBuffer = await response.arrayBuffer();
            if (speakInvocationRef.current !== currentInvId) return false;

            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;
            audioElementRef.current = audio;

            return new Promise<boolean>((resolve) => {
                audio.onended = () => {
                    URL.revokeObjectURL(url);
                    if (speakInvocationRef.current === currentInvId) audioElementRef.current = null;
                    resolve(true);
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    if (speakInvocationRef.current === currentInvId) audioElementRef.current = null;
                    resolve(false);
                };
                audio.play().catch(() => resolve(false));
            });
        } catch { return false; }
    }, [user]);

    // ─── Groq TTS via AudioContext (secondary) ─────────────────────────

    // ─── Groq TTS via <audio> element (primary) ────────────────────────
    // REPLACES the AudioContext approach to fix iOS call volume routing
    const speakWithGroq = useCallback(async (text: string): Promise<boolean> => {
        if (groqAvailableRef.current === false) return false;
        if (!user) return false;

        const currentInvId = speakInvocationRef.current;

        try {
            const response = await fetch('/api/voice/synthesize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });

            if (!response.ok || speakInvocationRef.current !== currentInvId) {
                if (response.status === 503 || response.status === 502) {
                    groqAvailableRef.current = false;
                    setTtsProvider('browser');
                }
                return false;
            }

            const arrayBuffer = await response.arrayBuffer();
            if (speakInvocationRef.current !== currentInvId) return false;

            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);

            // ✅ Use <audio> element — always routes to media volume on iOS
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                URL.revokeObjectURL(audioElementRef.current.src);
            }

            const audio = new Audio(url);
            audio.volume = 1.0;  // max volume, controlled by media volume buttons
            audioElementRef.current = audio;

            return new Promise<boolean>((resolve) => {
                audio.onended = () => {
                    URL.revokeObjectURL(url);
                    if (speakInvocationRef.current === currentInvId) audioElementRef.current = null;
                    resolve(true);
                };
                audio.onerror = () => {
                    URL.revokeObjectURL(url);
                    if (speakInvocationRef.current === currentInvId) audioElementRef.current = null;
                    resolve(false);
                };
                // ✅ Required on iOS: must call play() from a user gesture context
                // Since this is triggered from an AI response (not user gesture),
                // we need the audio element to be created fresh each time
                audio.play().catch(() => {
                    // iOS sometimes blocks autoplay - fall through to browser TTS
                    resolve(false);
                });
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

    const processQueueBrowser = useCallback(async (invId: number) => {
        while (queueRef.current.length > 0 && invId === speakInvocationRef.current) {
            if (isPausedRef.current) {
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            const chunk = queueRef.current.shift();
            if (chunk) {
                await speakWithBrowser(chunk);
            }
        }
    }, [speakWithBrowser]);

    // ─── Main speak function ───────────────────────────────────────────

    const speak = useCallback(async (text: string) => {
        if (!text) return;

        const invId = ++speakInvocationRef.current;

        // Clean text (remove markdown-ish artifacts)
        let cleanText = text.replace(/[*_#`]/g, '');
        cleanText = preprocessForTTS(cleanText);

        // Cancel any in-progress speech
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            if (audioElementRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioElementRef.current.src);
            }
            audioElementRef.current.onended = null;
            audioElementRef.current.onerror = null;
            audioElementRef.current = null;
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

        // ── Wait for provider detection if not yet resolved ──────────────────
        if (ttsProvider === 'detecting' || ttsProviderRef.current === 'detecting') {
            await new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    if (ttsProviderRef.current !== 'detecting' || invId !== speakInvocationRef.current) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 50);
                // Timeout after 4s — fall back to browser
                setTimeout(() => { clearInterval(interval); resolve(); }, 4000);
            });
        }

        if (invId !== speakInvocationRef.current) {
            processingRef.current = false;
            setIsSpeaking(false);
            return;
        }

        try {
            await new Promise(r => setTimeout(r, 50));
            if (invId !== speakInvocationRef.current) return;

            let success = false;

            // Pipeline checks: Polly → Groq → Browser (silent fallback)
            if (ttsProvider === 'polly' || ttsProviderRef.current === 'polly') {
                success = await speakWithPolly(cleanText);
                if (success) {
                    setCurrentProvider('polly');
                } else if (invId === speakInvocationRef.current) {
                    console.warn('[TTS] Polly failed, falling back to Groq');
                    setCurrentProvider('groq');
                }
            }

            if (invId === speakInvocationRef.current && !success && (ttsProvider === 'groq' || ttsProviderRef.current === 'groq')) {
                success = await speakWithGroq(cleanText);
                if (success) {
                    setCurrentProvider('groq');
                } else if (invId === speakInvocationRef.current) {
                    console.warn('[TTS] Groq failed, falling back to browser');
                    setCurrentProvider('browser');
                }
            }

            if (invId === speakInvocationRef.current && !success) {
                setCurrentProvider('browser');
                queueRef.current = chunkTextForSpeech(cleanText);
                await processQueueBrowser(invId);
            }
        } finally {
            if (invId === speakInvocationRef.current) {
                setIsSpeaking(false);
                processingRef.current = false;
                if (options.onEnd) options.onEnd();
            }
        }
    }, [ttsProvider, speakWithPolly, speakWithGroq, processQueueBrowser, options]);

    const pause = useCallback(() => {
        // Pause audio element
        if (audioElementRef.current) {
            audioElementRef.current.pause();
        }
        // Pause browser TTS
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
        setIsPaused(true);
        if (options.onPause) options.onPause();
    }, [options]);

    const resume = useCallback(() => {
        // Resume audio element
        if (audioElementRef.current) {
            audioElementRef.current.play().catch(() => { /* ignore */ });
        }
        // Resume browser TTS
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.resume();
        }
        setIsPaused(false);
    }, []);

    const stop = useCallback(() => {
        ++speakInvocationRef.current; // invalidate any in-flight speak() call

        // ✅ Stop <audio> element
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
            if (audioElementRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(audioElementRef.current.src);
            }
            audioElementRef.current.onended = null;
            audioElementRef.current.onerror = null;
            audioElementRef.current = null;
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
