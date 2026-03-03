'use client';
/**
 * useSTT — Groq Whisper → Browser SpeechRecognition → MediaRecorder cascade.
 *
 * Three-tier provider resolution:
 *   1. 'whisper'  — VAD owns mic, sends audio via transcribeAudio(Float32Array).
 *   2. 'browser'  — Chrome/Edge SpeechRecognition with auto-restart loop.
 *   3. 'recorder' — MediaRecorder + Whisper API fallback (Firefox/Safari/Brave).
 *   4. 'none'     — no STT available.
 *
 * Phase 0 fixes: listeningIntentRef auto-restart, no-speech handling.
 * Phase 1 fixes: MediaRecorder fallback, three-tier cascade, permission state.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionEvent = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionErrorEvent = any;

export type STTProvider = 'whisper' | 'browser';
export type ResolvedSTTProvider = 'whisper' | 'browser' | 'recorder' | 'none';

export interface UseSTTOptions {
    provider: STTProvider;
    language?: string;
    silenceMs?: number;
    onTranscript: (text: string, isFinal: boolean) => void;
    onSilenceTimeout?: () => void;
    onError?: (err: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyW = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };

/** Detect best supported MIME type for MediaRecorder */
function getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (const t of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
}

export function useSTT(opts: UseSTTOptions) {
    const { provider, language = 'en-IN', silenceMs = 5000 } = opts;

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recRef = useRef<any>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    // Phase 0a: listeningIntentRef — stays true until stopListening() is explicitly called
    const listeningIntentRef = useRef(false);
    // Track restart debounce
    const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Ref to break circular dependency: onend → startListening
    const startListeningRef = useRef<() => void>(() => { });

    // Phase 1c: Three-tier provider resolution
    const resolvedProvider: ResolvedSTTProvider = useMemo(() => {
        if (provider === 'whisper') return 'whisper';

        if (typeof window === 'undefined') return 'none';

        const w = window as AnyW;
        const hasSR = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
        if (hasSR) return 'browser';

        // No SpeechRecognition — fall back to MediaRecorder + Whisper
        const hasRecorder = !!(
            typeof MediaRecorder !== 'undefined' && navigator.mediaDevices?.getUserMedia
        );
        if (hasRecorder) return 'recorder';

        return 'none';
    }, [provider]);

    // Phase 1d: Mic permission state tracking
    useEffect(() => {
        if (typeof navigator === 'undefined' || !navigator.permissions) return;
        navigator.permissions
            .query({ name: 'microphone' as PermissionName })
            .then(status => {
                setPermissionState(status.state as typeof permissionState);
                status.onchange = () =>
                    setPermissionState(status.state as typeof permissionState);
            })
            .catch(() => setPermissionState('unknown'));
    }, []);

    const clearTimer = useCallback(() => {
        if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    }, []);

    const armTimer = useCallback(() => {
        clearTimer();
        silenceTimer.current = setTimeout(() => optsRef.current.onSilenceTimeout?.(), silenceMs);
    }, [silenceMs, clearTimer]);

    // Phase 1b: MediaRecorder fallback for non-Chrome browsers
    const startRecorderFallback = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
            });
            const mimeType = getSupportedMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            recorder.onstop = async () => {
                // Release mic tracks
                stream.getTracks().forEach(t => t.stop());

                const blob = new Blob(chunks, { type: recorder.mimeType });
                if (blob.size < 1000) return; // Too small — skip
                const form = new FormData();
                form.append('audio', blob, 'audio.webm');
                try {
                    const res = await fetch('/api/voice/transcribe', {
                        method: 'POST',
                        body: form
                    });
                    if (!res.ok) return;
                    const { text } = await res.json();
                    if (text?.trim()) {
                        setTranscript(p => p ? `${p} ${text}` : text);
                        optsRef.current.onTranscript(text, true);
                    }
                } catch (err) {
                    console.error('[STT] Recorder transcription failed:', err);
                }
            };

            recorder.start();
            recorderRef.current = recorder;
            setIsListening(true);
            armTimer();
        } catch {
            optsRef.current.onError?.('Microphone access denied or unavailable.');
        }
    }, [armTimer]);

    const stopListening = useCallback(() => {
        // Phase 0a: Clear listening intent
        listeningIntentRef.current = false;
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
            restartTimerRef.current = null;
        }

        clearTimer();
        setIsListening(false);
        setInterimTranscript('');

        if (resolvedProvider === 'browser' && recRef.current) {
            try { recRef.current.stop(); } catch { /* ignore */ }
        }
        if (resolvedProvider === 'recorder' && recorderRef.current) {
            try { recorderRef.current.stop(); } catch { /* ignore */ }
            recorderRef.current = null;
        }
    }, [resolvedProvider, clearTimer]);

    const startListening = useCallback(() => {
        // Phase 0a: Set listening intent
        listeningIntentRef.current = true;

        switch (resolvedProvider) {
            case 'whisper': {
                setIsListening(true);
                armTimer();
                return;
            }

            case 'browser': {
                const w = window as AnyW;
                const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
                if (!SR) { optsRef.current.onError?.('Speech recognition not supported. Use Chrome or Edge.'); return; }
                if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }

                const rec = new SR();
                rec.lang = language;
                rec.continuous = true;
                rec.interimResults = true;
                recRef.current = rec;

                rec.onstart = () => { setIsListening(true); armTimer(); };

                rec.onresult = (e: SpeechRecognitionEvent) => {
                    let final = '', interim = '';
                    for (let i = e.resultIndex; i < e.results.length; i++) {
                        if (e.results[i].isFinal) final += e.results[i][0].transcript;
                        else interim += e.results[i][0].transcript;
                    }
                    if (final) { setTranscript(p => p ? `${p} ${final}` : final); setInterimTranscript(''); optsRef.current.onTranscript(final, true); armTimer(); }
                    if (interim) { setInterimTranscript(interim); optsRef.current.onTranscript(interim, false); armTimer(); }
                };

                rec.onerror = (e: SpeechRecognitionErrorEvent) => {
                    // Phase 0b: no-speech and aborted are benign — let onend handle restart
                    if (e.error === 'no-speech' || e.error === 'aborted') return;
                    optsRef.current.onError?.(e.error === 'not-allowed' ? 'Microphone access denied.' : `STT error: ${e.error}`);
                    listeningIntentRef.current = false; // Fatal error — stop intent
                    setIsListening(false);
                };

                // Phase 0a: Auto-restart on benign onend
                rec.onend = () => {
                    if (listeningIntentRef.current) {
                        // Chrome ended session but we still want to listen — restart with debounce
                        restartTimerRef.current = setTimeout(() => {
                            restartTimerRef.current = null;
                            if (listeningIntentRef.current) {
                                startListeningRef.current(); // Use ref to avoid circular dependency
                            }
                        }, 300);
                    } else {
                        setIsListening(false);
                    }
                };

                rec.start();
                return;
            }

            case 'recorder': {
                startRecorderFallback();
                return;
            }

            case 'none': {
                optsRef.current.onError?.('No speech recognition available. Try Chrome, Edge, or enable Whisper STT.');
                return;
            }
        }
    }, [resolvedProvider, language, armTimer, startRecorderFallback]);

    // Keep startListeningRef in sync so the onend handler always calls the latest version
    useEffect(() => { startListeningRef.current = startListening; }, [startListening]);

    /** Called by VAD onSpeechEnd — Whisper or recorder mode */
    const transcribeAudio = useCallback(async (audio: Float32Array) => {
        // Phase 3d: Accept both whisper and recorder providers
        if (resolvedProvider !== 'whisper' && resolvedProvider !== 'recorder') return;
        try {
            const wav = float32ToWav(audio, 16000);
            const form = new FormData();
            form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
            const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
            if (!res.ok) return;
            const { text } = await res.json() as { text: string };
            if (!text?.trim()) return;
            setTranscript(p => p ? `${p} ${text}` : text);
            optsRef.current.onTranscript(text, true);
            armTimer();
        } catch (err) { console.error('[STT] Whisper transcription failed:', err); }
    }, [resolvedProvider, armTimer]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    useEffect(() => () => {
        clearTimer();
        if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
        if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
        if (recorderRef.current) { try { recorderRef.current.stop(); } catch { /* ignore */ } }
    }, [clearTimer]);

    return {
        isListening,
        transcript,
        interimTranscript,
        startListening,
        stopListening,
        resetTranscript,
        transcribeAudio,
        resolvedProvider,
        permissionState,
    };
}

// Minimal PCM → WAV encoder
function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buf);
    const w = (off: number, v: number, n: number) => n === 4 ? view.setUint32(off, v, true) : n === 2 ? view.setUint16(off, v, true) : view.setUint8(off, v);
    'RIFF'.split('').forEach((c, i) => w(i, c.charCodeAt(0), 1));
    w(4, 36 + dataSize, 4); w(8, 0x45564157, 4); w(12, 0x20746d66, 4); w(16, 16, 4); w(20, 1, 2);
    w(22, 1, 2); w(24, sampleRate, 4); w(28, byteRate, 4); w(32, blockAlign, 2); w(34, bitsPerSample, 2);
    'data'.split('').forEach((c, i) => w(38 + i, c.charCodeAt(0), 1));
    w(42, dataSize, 4);
    let off = 44;
    for (const s of samples) {
        const clipped = Math.max(-1, Math.min(1, s));
        view.setInt16(off, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
        off += 2;
    }
    return buf;
}
