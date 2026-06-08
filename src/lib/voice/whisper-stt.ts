/**
 * @codesage
 * @description WhisperSTT integration for Groq Whisper API transcription.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
/**
 * WhisperSTT — Groq Whisper API transcription client
 *
 * Captures audio via MediaRecorder, sends to /api/voice/transcribe,
 * and returns the transcript.
 *
 * Used as primary STT provider when:
 * 1. ENABLE_WHISPER_STT feature flag is on (global, from server)
 * 2. User's browser supports MediaRecorder + getUserMedia
 * 3. Groq API is reachable
 */

export interface WhisperConfig {
    /** Max recording duration before auto-send. Default: 30000ms */
    maxDurationMs: number;
    /** Silence duration before auto-send. Default: 2000ms */
    silenceGapMs: number;
    /** Audio MIME type. Default: auto-detected. */
    mimeType?: string;
}

export interface TranscriptionResult {
    text: string;
    isFinal: boolean;
    confidence?: number;
    model: 'whisper-large-v3-turbo' | 'whisper-large-v3';
    latencyMs: number;
}

export type WhisperSTTCallback = (result: TranscriptionResult) => void;

export class WhisperSTT {
    private onTranscript: WhisperSTTCallback;
    // @ts-expect-error -- automated unused local suppression
    private config: WhisperConfig;

    constructor(onTranscript: WhisperSTTCallback, config?: Partial<WhisperConfig>) {
        this.onTranscript = onTranscript;
        this.config = {
            maxDurationMs: 30000,
            silenceGapMs: 800,
            ...config,
        };
    }

    static isSupported(): boolean {
        return !!(
            typeof window !== 'undefined' &&
            window.MediaRecorder &&
            navigator.mediaDevices?.getUserMedia
        );
    }

    /**
     * Transcribe a Float32Array captured by VAD's onSpeechEnd.
     * No getUserMedia call needed — audio comes from VAD's existing stream.
     */
    async transcribeVADAudio(audio: Float32Array, sampleRate = 16000): Promise<void> {
        const startMs = Date.now();

        // Convert Float32Array → WAV Blob
        const wavBlob = float32ToWav(audio, sampleRate);

        if (wavBlob.size < 1000) {
            // Too small — likely noise or mic startup artifact; skip
            console.warn('[WhisperSTT] Audio too short, skipping transcription');
            return;
        }

        const formData = new FormData();
        formData.append('audio', wavBlob, 'speech.wav');

        try {
            const res = await fetch('/api/voice/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                console.error('[WhisperSTT] Transcription failed:', res.status);
                return;
            }

            const data = await res.json();
            const text = data.text?.trim();

            if (!text || text.length < 2) return; // Filter empty/noise results

            this.onTranscript({
                text,
                isFinal: true,
                confidence: data.confidence,
                model: data.model || 'whisper-large-v3-turbo',
                latencyMs: Date.now() - startMs,
            });
        } catch (err) {
            console.error('[WhisperSTT] Network error:', err);
        }
    }
}

// ── WAV encoder (no external deps) ──────────────────────────────────────────

function float32ToWav(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);         // PCM format chunk size
    view.setUint16(20, 1, true);          // PCM format
    view.setUint16(22, 1, true);          // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true);          // block align
    view.setUint16(34, 16, true);         // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

