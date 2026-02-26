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
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private silenceTimer: ReturnType<typeof setTimeout> | null = null;
    private maxTimer: ReturnType<typeof setTimeout> | null = null;
    private isRecording = false;
    private onTranscript: WhisperSTTCallback;
    private config: WhisperConfig;
    private analyserNode: AnalyserNode | null = null;
    private audioContext: AudioContext | null = null;
    private silenceCheckInterval: ReturnType<typeof setInterval> | null = null;
    private readonly SILENCE_THRESHOLD = 0.02; // RMS below this = silence
    private isSpeaking = false;

    constructor(onTranscript: WhisperSTTCallback, config?: Partial<WhisperConfig>) {
        this.onTranscript = onTranscript;
        this.config = {
            maxDurationMs: 30000,
            silenceGapMs: 2000,
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

    static getSupportedMimeType(): string {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ];
        return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    }

    async start(): Promise<void> {
        if (this.isRecording) return;

        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000, // Optimal for Whisper
                echoCancellation: true,
                noiseSuppression: true,
            }
        });

        // ✅ NEW: Set up AudioContext for real silence detection
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        source.connect(this.analyserNode);

        const mimeType = this.config.mimeType || WhisperSTT.getSupportedMimeType();
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType,
            audioBitsPerSecond: 16000,
        });

        this.audioChunks = [];
        this.isRecording = true;

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.audioChunks.push(e.data);
                // ✅ DON'T reset silence timer here anymore
            }
        };

        this.mediaRecorder.onstop = async () => {
            await this.sendForTranscription();
        };

        // Collect data every 500ms (not just at end)
        this.mediaRecorder.start(500);

        // Max duration guard
        this.maxTimer = setTimeout(() => this.stop(), this.config.maxDurationMs);

        // ✅ NEW: Real silence detection via volume analysis
        this.startSilenceMonitor();
    }

    // ✅ NEW: Volume-based silence detector
    private startSilenceMonitor(): void {
        if (!this.analyserNode) return;

        const dataArray = new Uint8Array(this.analyserNode.fftSize);
        let silenceStartTime: number | null = null;

        this.silenceCheckInterval = setInterval(() => {
            if (!this.analyserNode || !this.isRecording) return;

            this.analyserNode.getByteTimeDomainData(dataArray);

            // Calculate RMS volume
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const sample = (dataArray[i] / 128.0) - 1.0;
                sum += sample * sample;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            if (rms < this.SILENCE_THRESHOLD) {
                // Silence detected
                if (silenceStartTime === null) {
                    silenceStartTime = Date.now();
                } else if (Date.now() - silenceStartTime > this.config.silenceGapMs) {
                    // Been silent for long enough
                    if (this.audioChunks.length > 0) {
                        this.stop();
                    }
                }
            } else {
                // Speech detected
                silenceStartTime = null;
                this.isSpeaking = true;
            }
        }, 100); // Check every 100ms
    }

    stop(): void {
        if (!this.isRecording) return;
        this.isRecording = false;

        if (this.silenceCheckInterval) clearInterval(this.silenceCheckInterval);
        if (this.silenceTimer) clearTimeout(this.silenceTimer);
        if (this.maxTimer) clearTimeout(this.maxTimer);

        if (this.mediaRecorder?.state !== 'inactive') {
            this.mediaRecorder?.stop();
        }

        this.stream?.getTracks().forEach(t => t.stop());
        this.audioContext?.close();
        this.stream = null;
        this.audioContext = null;
        this.analyserNode = null;
    }

    private async sendForTranscription(): Promise<void> {
        if (this.audioChunks.length === 0) return;

        const startTime = Date.now();
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Skip if audio is too short (< 300ms at typical bitrate = < 5KB)
        if (blob.size < 5000) return;

        try {
            const formData = new FormData();
            formData.append('audio', blob, `recording.${mimeType.split('/')[1].split(';')[0]}`);

            const response = await fetch('/api/voice/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Transcription API returned ${response.status}`);
            }

            const data = await response.json();
            const latencyMs = Date.now() - startTime;

            this.onTranscript({
                text: data.text,
                isFinal: true,
                confidence: data.confidence,
                model: data.model,
                latencyMs,
            });
        } catch (error) {
            console.error('[WhisperSTT] Transcription failed:', error);
            // Silent fail — UI shows "using fallback"
        }
    }

    destroy(): void {
        this.stop();
        this.mediaRecorder = null;
        this.audioChunks = [];
    }
}
