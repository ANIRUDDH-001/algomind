/**
 * @codesage
 * @file      src/hooks/useTTS.ts
 * @purpose   Thin React wrapper over the SpeechQueue singleton (the only owner of speechSynthesis).
 * @tech      React, Web Speech API
 * @connects  @/lib/voice/speech-queue; used by useInterview and useUnifiedVoice
 * @apis      none
 * @db        none
 * @state     isSpeaking / blocked mirrored from queue events
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSpeechQueue, type SpeechQueueEvent } from '@/lib/voice/speech-queue';

export type TTSProvider = 'browser';

export interface UseTTSOptions {
    onSpeakStart?: () => void;
    onSpeakEnd?: () => void;
    /** Diagnostics: first-audio latency and engine errors (turn timeline). */
    onEvent?: (e: Extract<SpeechQueueEvent, { type: 'first-audio' | 'error' | 'blocked' }>) => void;
    voiceName?: string | null;
    voiceRate?: number;
    voicePitch?: number;
    /** Kept for settings compatibility; speech is always the browser engine (free-only). */
    userTtsProvider?: 'auto' | 'polly' | 'browser';
}

export function useTTS(opts: UseTTSOptions = {}) {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [blocked, setBlocked] = useState(false);
    const blockedRef = useRef(false);
    const optsRef = useRef(opts);
    // Latest callbacks for queue events (queue events always arrive after commit).
    useEffect(() => { optsRef.current = opts; });

    // Subscribe once; the queue outlives this component (window singleton).
    useEffect(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const q = getSpeechQueue();
        return q.on((e) => {
            if (e.type === 'speaking') {
                setIsSpeaking(e.value);
                if (e.value) optsRef.current.onSpeakStart?.();
                else optsRef.current.onSpeakEnd?.();
            } else if (e.type === 'blocked') {
                blockedRef.current = true;
                setBlocked(true);
                optsRef.current.onEvent?.(e);
            } else {
                optsRef.current.onEvent?.(e);
            }
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        getSpeechQueue().configure({
            preferredVoiceName: opts.voiceName ?? null,
            rate: opts.voiceRate ?? 1.0,
            pitch: opts.voicePitch ?? 1.0,
        });
    }, [opts.voiceName, opts.voiceRate, opts.voicePitch]);

    const enqueue = useCallback((text: string) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        getSpeechQueue().enqueue(text);
    }, []);

    /** Fire-and-forget: queue the whole text (split into speakable pieces by the queue). */
    const speak = useCallback(async (text: string) => { enqueue(text); }, [enqueue]);

    const whenIdle = useCallback((): Promise<void> => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve();
        return getSpeechQueue().whenIdle();
    }, []);

    /** Await playback of `text`. Resolves false when the browser blocked speech (needs a user gesture). */
    const speakAndWait = useCallback(async (text: string, _retries?: number): Promise<boolean> => {
        enqueue(text);
        await whenIdle();
        return !blockedRef.current;
    }, [enqueue, whenIdle]);

    const stop = useCallback(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) getSpeechQueue().stop();
        setIsSpeaking(false);
    }, []);

    /** Call synchronously inside a click handler (Chrome user-activation rule). */
    const unlock = useCallback(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) getSpeechQueue().unlock();
        blockedRef.current = false;
        setBlocked(false);
    }, []);

    return { speak, speakAndWait, enqueue, whenIdle, stop, unlock, isSpeaking, blocked, provider: 'browser' as TTSProvider };
}
