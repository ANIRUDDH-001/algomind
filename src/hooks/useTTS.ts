'use client';
/**
 * useTTS — React wrapper for TTSEngine.
 * - Polly enabled flag read from /api/flags ONCE on mount.
 * - Voice loaded from user_preferences via passed prop.
 * - onSpeakStart/onSpeakEnd fire reliably (used to gate mic).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { TTSEngine, type TTSProvider } from '@/lib/voice/tts-engine';

export interface UseTTSOptions {
    onSpeakStart?: () => void;
    onSpeakEnd?: () => void;
    voiceName?: string | null;
    voiceRate?: number;
    voicePitch?: number;
}

export function useTTS(opts: UseTTSOptions = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [provider, setProvider] = useState<TTSProvider | 'idle'>('idle');
    const [pollyEnabled, setPollyEnabled] = useState(false);
    const [prefVoice, setPrefVoice] = useState<SpeechSynthesisVoice | null>(null);

    const engineRef = useRef<TTSEngine | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    // 1. Detect Polly flag ONCE
    useEffect(() => {
        fetch('/api/flags', { signal: AbortSignal.timeout(3000) })
            .then(r => r.ok ? r.json() : {})
            .then((f: any) => setPollyEnabled(f['ENABLE_AWS_POLLY_TTS']?.value === true))
            .catch(() => setPollyEnabled(false));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount only

    // 3b. Update voice config on existing engine (no destroy/recreate)
    useEffect(() => {
        engineRef.current?.setVoiceConfig(
            prefVoice,
            opts.voiceRate ?? 1.0,
            opts.voicePitch ?? 1.0
        );
    }, [prefVoice, opts.voiceRate, opts.voicePitch]);

    // 4. Override browser voice settings on utterance level via a wrapper speak
    const speak = useCallback(async (text: string) => {
        const engine = engineRef.current;
        if (!engine) {
            console.warn('[useTTS] speak() called but engine is null — TTS not ready');
            return;
        }
        const cleaned = text.replace(/[*_#`~]/g, '').trim();
        if (!cleaned) {
            console.warn('[useTTS] speak() called with empty text after cleaning');
            return;
        }
        console.log(`[useTTS] speak() → engine.speak(), textLen=${cleaned.length}, polly=${pollyEnabled}`);
        const used = await engine.speak(cleaned, pollyEnabled);
        console.log(`[useTTS] engine.speak() resolved, provider=${used}`);
        setProvider(used);
    }, [pollyEnabled]);

    const stop = useCallback(() => {
        engineRef.current?.stop();
        setIsSpeaking(false);
    }, []);

    return { speak, stop, isSpeaking, provider, prefVoice, setPrefVoice };
}
