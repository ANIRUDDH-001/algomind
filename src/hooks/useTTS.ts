'use client';
/**
 * useTTS — React wrapper for TTSEngine.
 * - Polly enabled flag read from /api/flags ONCE on mount.
 * - Voice loaded from user_preferences via passed prop.
 * - onSpeakStart/onSpeakEnd fire reliably (used to gate mic).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { TTSEngine, type TTSProvider } from '@/lib/voice/tts-engine';
import { preprocessForTTS } from '@/lib/voice/tts-preprocessor';
import { getVoiceRuntimeFlags } from '@/lib/api/adapters/voice-adapter';

export interface UseTTSOptions {
    onSpeakStart?: () => void;
    onSpeakEnd?: () => void;
    voiceName?: string | null;
    voiceRate?: number;
    voicePitch?: number;
    userTtsProvider?: 'auto' | 'polly' | 'browser';
}

export function useTTS(opts: UseTTSOptions = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [provider, setProvider] = useState<TTSProvider | 'idle'>('idle');
    const [pollyEnabled, setPollyEnabled] = useState(false);
    const [prefVoice, setPrefVoice] = useState<SpeechSynthesisVoice | null>(null);

    const engineRef = useRef<TTSEngine | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    // 1. Detect Polly flag on mount + listen for runtime changes (TTS-4 fix)
    useEffect(() => {
        const fetchPollyFlag = () => {
            getVoiceRuntimeFlags({ pollyEnabled: false, whisperEnabled: true })
                .then(runtime => {
                    const userPref = optsRef.current.userTtsProvider ?? 'auto';
                    if (userPref === 'browser') {
                        setPollyEnabled(false);
                        return;
                    }
                    setPollyEnabled(runtime.pollyEnabled);
                })
                .catch(() => setPollyEnabled(false));
        };
        fetchPollyFlag();
        // Re-fetch when owner panel toggles the flag
        window.addEventListener('polly-flag-changed', fetchPollyFlag);
        return () => window.removeEventListener('polly-flag-changed', fetchPollyFlag);
    }, []);

    // 2. Pick best browser voice (respects voiceName preference from user_preferences)
    useEffect(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const pick = () => {
            const voices = window.speechSynthesis.getVoices();
            const name = optsRef.current.voiceName;
            const best = name
                ? (voices.find(v => v.name === name) ?? voices.find(v => v.lang.startsWith('en')) ?? voices[0] ?? null)
                : (voices.find(v => v.lang.startsWith('en-IN')) ?? voices.find(v => v.lang.startsWith('en')) ?? null);
            setPrefVoice(best);
        };
        pick();
        window.speechSynthesis.onvoiceschanged = pick;
        return () => { window.speechSynthesis.onvoiceschanged = null; };
    }, []);

    // 3. Create engine ONCE on mount — never destroy/recreate mid-session.
    // Previously, this effect depended on [prefVoice, voiceRate, voicePitch],
    // causing destroy()+recreate on EVERY voice config change. Each destroy()
    // incremented invId (cancelling in-flight speak()) and fired spurious
    // onSpeakingChange(false) → onSpeakEnd → mic-sync reset → transcript cleared.
    useEffect(() => {
        const engine = new TTSEngine();
        engine.onSpeakingChange = (v) => {
            setIsSpeaking(v);
            if (v) optsRef.current.onSpeakStart?.();
            else optsRef.current.onSpeakEnd?.();
        };
        engineRef.current = engine;
        return () => { engine.destroy(); engineRef.current = null; };
         
    }, []); // mount only

    // 3b. Update voice config on existing engine (no destroy/recreate)
    useEffect(() => {
        engineRef.current?.setVoiceConfig(
            prefVoice,
            opts.voiceRate ?? 1.0,
            opts.voicePitch ?? 1.0
        );
    }, [prefVoice, opts.voiceRate, opts.voicePitch]);

    // 4. speak — fire-and-forget (backward compat). speakAndWait — awaits completion.
    const speak = useCallback(async (text: string) => {
        const engine = engineRef.current;
        if (!engine) {
            console.warn('[useTTS] speak() called but engine is null — TTS not ready');
            return;
        }
        const cleaned = preprocessForTTS(text.replace(/[*_#`~]/g, '')).trim();
        if (!cleaned) {
            console.warn('[useTTS] speak() called with empty text after cleaning');
            return;
        }
        const result = await engine.speak(cleaned, pollyEnabled);
        setProvider(result.provider);
    }, [pollyEnabled]);

    /** Await TTS completion. Returns success (true if speech was audibly played). Retries up to `retries` times on failure. */
    const speakAndWait = useCallback(async (text: string, retries = 3): Promise<boolean> => {
        const engine = engineRef.current;
        if (!engine) {
            console.warn('[useTTS] speakAndWait() called but engine is null');
            return false;
        }
        const cleaned = preprocessForTTS(text.replace(/[*_#`~]/g, '')).trim();
        if (!cleaned) return false;

        for (let attempt = 1; attempt <= retries; attempt++) {
            const result = await engine.speak(cleaned, pollyEnabled);
            setProvider(result.provider);
            if (result.success) {
                return true;
            }
            console.warn(`[useTTS] speakAndWait attempt ${attempt} failed`);
            // Short delay before retry
            if (attempt < retries) await new Promise(r => setTimeout(r, 300));
        }
        console.error(`[useTTS] speakAndWait failed after ${retries} retries`);
        return false;
    }, [pollyEnabled]);

    const stop = useCallback(() => {
        engineRef.current?.stop();
        setIsSpeaking(false);
    }, []);

    return { speak, speakAndWait, stop, isSpeaking, provider, prefVoice, setPrefVoice };
}
