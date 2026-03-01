'use client';
/**
 * useSTT — Groq Whisper → Browser SpeechRecognition cascade.
 * 
 * Whisper mode: VAD owns mic, sends audio via transcribeAudio(Float32Array).
 * Browser mode: manages its own SpeechRecognition.
 * 5-second silence → onSilenceTimeout → caller shows SEND button.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export type STTProvider = 'whisper' | 'browser';

export interface UseSTTOptions {
    provider: STTProvider;
    language?: string;
    silenceMs?: number;
    onTranscript: (text: string, isFinal: boolean) => void;
    onSilenceTimeout?: () => void;
    onError?: (err: string) => void;
}

type AnyW = Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };

export function useSTT(opts: UseSTTOptions) {
    const { provider, language = 'en-IN', silenceMs = 5000 } = opts;

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');

    const recRef = useRef<any>(null);
    const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const optsRef = useRef(opts);
    useEffect(() => { optsRef.current = opts; }, [opts]);

    const clearTimer = useCallback(() => {
        if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    }, []);

    const armTimer = useCallback(() => {
        clearTimer();
        silenceTimer.current = setTimeout(() => optsRef.current.onSilenceTimeout?.(), silenceMs);
    }, [silenceMs, clearTimer]);

    const stopListening = useCallback(() => {
        clearTimer();
        setIsListening(false);
        setInterimTranscript('');
        if (provider === 'browser' && recRef.current) {
            try { recRef.current.stop(); } catch { /* ignore */ }
        }
    }, [provider, clearTimer]);

    const startListening = useCallback(() => {
        if (provider === 'whisper') {
            setIsListening(true);
            armTimer();
            return;
        }

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

        rec.onresult = (e: any) => {
            let final = '', interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                if (e.results[i].isFinal) final += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }
            if (final) { setTranscript(p => p ? `${p} ${final}` : final); setInterimTranscript(''); optsRef.current.onTranscript(final, true); armTimer(); }
            if (interim) { setInterimTranscript(interim); optsRef.current.onTranscript(interim, false); armTimer(); }
        };

        rec.onerror = (e: any) => {
            if (e.error === 'no-speech' || e.error === 'aborted') return;
            optsRef.current.onError?.(e.error === 'not-allowed' ? 'Microphone access denied.' : `STT error: ${e.error}`);
            setIsListening(false);
        };

        rec.onend = () => setIsListening(false);
        rec.start();
    }, [provider, language, armTimer]);

    /** Called by VAD onSpeechEnd — Whisper mode only */
    const transcribeAudio = useCallback(async (audio: Float32Array) => {
        if (provider !== 'whisper') return;
        try {
            // Convert Float32Array → WAV blob → POST to /api/voice/transcribe
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
    }, [provider, armTimer]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    useEffect(() => () => {
        clearTimer();
        if (recRef.current) { try { recRef.current.stop(); } catch { /* ignore */ } }
    }, [clearTimer]);

    return { isListening, transcript, interimTranscript, startListening, stopListening, resetTranscript, transcribeAudio };
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
