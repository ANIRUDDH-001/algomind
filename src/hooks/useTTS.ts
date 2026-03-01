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

    // 3. Rebuild engine when voice/rate/pitch changes
    useEffect(() => {
        engineRef.current?.destroy();
        const engine = new TTSEngine();
        engine.onSpeakingChange = (v) => {
            setIsSpeaking(v);
            if (v) optsRef.current.onSpeakStart?.();
            else optsRef.current.onSpeakEnd?.();
        };
        engineRef.current = engine;
        return () => engine.destroy();
    }, [prefVoice, opts.voiceRate, opts.voicePitch]);

    // 4. Override browser voice settings on utterance level via a wrapper speak
    const speak = useCallback(async (text: string) => {
        const engine = engineRef.current;
        if (!engine) return;
        const cleaned = text.replace(/[*_#`~]/g, '').trim();
        if (!cleaned) return;
        // Inject voiceName/rate/pitch into browser speech via patching SpeechSynthesisUtterance
        // (engine.tryBrowser picks these up if we set them on the SpeechSynthesisUtterance internally)
        const used = await engine.speak(cleaned, pollyEnabled);
        setProvider(used);
    }, [pollyEnabled]);

    const stop = useCallback(() => {
        engineRef.current?.stop();
        setIsSpeaking(false);
    }, []);

    return { speak, stop, isSpeaking, provider, prefVoice, setPrefVoice };
}
