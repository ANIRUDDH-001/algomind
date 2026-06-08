/**
 * @codesage
 * @description Implements the TTSEngine bridging AWS Polly and Browser WebSpeech APIs.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 */
// @ts-nocheck

/**
 * TTSEngine
 * Polly → Browser WebSpeech cascade.
 * Single <audio> element (not AudioContext) — iOS uses media volume correctly.
 * Invocation ID prevents race conditions (new speak() cancels previous).
 */
export type TTSProvider = 'polly' | 'browser';

export class TTSEngine {
    private audioEl: HTMLAudioElement | null = null;
    private audioResolve: ((v: boolean) => void) | null = null;
    private invId = 0;
    private _speaking = false;
    onSpeakingChange?: (v: boolean) => void;

    private _voice: SpeechSynthesisVoice | null = null;
    private _rate = 1.0;
    private _pitch = 1.0;

    setVoiceConfig(voice: SpeechSynthesisVoice | null, rate: number, pitch: number) {
        this._voice = voice;
        this._rate = Math.max(0.5, Math.min(2.0, rate));
        this._pitch = Math.max(0.5, Math.min(2.0, pitch));
    }

    get isSpeaking() { return this._speaking; }

    private setSpeaking(v: boolean) {
        this._speaking = v;
        this.onSpeakingChange?.(v);
    }

    async speak(text: string, pollyEnabled: boolean): Promise<{ provider: TTSProvider; success: boolean }> {
        if (!text.trim()) { return { provider: 'browser', success: false }; }
        const id = ++this.invId;
        const wasSpeaking = this._speaking;
        this.cancel();
        // Chrome bug: speechSynthesis.cancel() followed by immediate speak()
        // causes the new utterance to be silently discarded. A small delay lets
        // the cancel complete — but ONLY when we actually cancelled something.
        if (wasSpeaking) {
            await new Promise(r => setTimeout(r, 100));
            if (id !== this.invId) { console.log('[TTS] Cancelled by newer speak()'); return { provider: 'browser', success: false }; }
        }
        this.setSpeaking(true);
        let used: TTSProvider = 'browser';
        let success = false;
        try {
            if (pollyEnabled && id === this.invId) {
                const ok = await this.tryPolly(text, id);
                if (ok) { used = 'polly'; success = true; return { provider: used, success }; }
                console.warn('[TTS] Polly failed, falling back to browser');
            }
            if (id === this.invId) {
                success = await this.tryBrowser(text, id);
            }
        } finally {
            if (id === this.invId) this.setSpeaking(false);
        }
        return { provider: used, success };
    }

    stop() {
        this.invId++;
        this.cancel();
        // Only fire onSpeakingChange if we WERE actually speaking.
        // Previously, every destroy()/stop() fired onSpeakingChange(false) even
        // when idle, producing spurious onSpeakEnd events that cascaded into
        // mic-sync resets and transcript clearing.
        const wasSpeaking = this._speaking;
        this._speaking = false;
        if (wasSpeaking) this.onSpeakingChange?.(false);
    }

    destroy() { this.stop(); }

    private cancel() {
        if (this.audioEl) {
            this.audioEl.pause();
            if (this.audioEl.src?.startsWith('blob:')) URL.revokeObjectURL(this.audioEl.src);
            this.audioEl.onended = null;
            this.audioEl.onerror = null;
            this.audioEl = null;
        }
        // Resolve any hanging playBuffer() promise so speakAndWait() unblocks
        if (this.audioResolve) {
            this.audioResolve(false);
            this.audioResolve = null;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }

    private async tryPolly(text: string, id: number): Promise<boolean> {
        try {
            const res = await fetch('/api/voice/synthesize-polly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
                signal: AbortSignal.timeout(8000),
            });
            if (!res.ok || id !== this.invId) return false;
            const buf = await res.arrayBuffer();
            if (id !== this.invId) return false;
            return this.playBuffer(buf, id);
        } catch { return false; }
    }

    private playBuffer(buf: ArrayBuffer, id: number): Promise<boolean> {
        return new Promise((resolve) => {
            this.audioResolve = resolve;
            const blob = new Blob([buf], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;

            // Mobile speaker routing fixes: playsinline prevents call routing/full-screening
            audio.setAttribute('playsinline', '');
            (audio as any).playsInline = true;

            // Attempt to force default media output speaker device (especially on Chrome Android/Windows)
            if ('setSinkId' in audio && typeof (audio as any).setSinkId === 'function') {
                (audio as any).setSinkId('default').catch((err: any) => {
                    console.warn('[TTS] Failed to set sink ID to default:', err);
                });
            }

            this.audioEl = audio;
            audio.onended = () => {
                URL.revokeObjectURL(url);
                if (id === this.invId) this.audioEl = null;
                this.audioResolve = null;
                resolve(true);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                if (id === this.invId) this.audioEl = null;
                this.audioResolve = null;
                resolve(false);
            };
            audio.play().catch(() => { this.audioResolve = null; resolve(false); });
        });
    }

    private tryBrowser(text: string, id: number): Promise<boolean> {
        return new Promise(async (resolve) => {
            if (typeof window === 'undefined' || !window.speechSynthesis || id !== this.invId) {
                console.warn('[TTS] Browser TTS unavailable or cancelled');
                resolve(false);
                return;
            }

            // A1 fix: Chunk long text by sentences to avoid 30s browser timeout.
            // Each chunk stays under the limit. Short text (<200 chars) is spoken as-is.
            const chunks = text.length > 200 ? this.splitBySentence(text) : [text];

            let anySuccess = false;
            for (const chunk of chunks) {
                if (id !== this.invId) { resolve(anySuccess); return; }
                const ok = await this.speakSingleChunk(chunk, id);
                if (ok) anySuccess = true;
                else if (!anySuccess) { 
                    if (id === this.invId) {
                        console.warn('[TTS] First chunk failed, retrying once...');
                        const retryOk = await this.speakSingleChunk(chunk, id);
                        if (retryOk) anySuccess = true;
                        else { resolve(false); return; }
                    } else {
                        resolve(false); return; 
                    }
                }
            }
            resolve(anySuccess);
        });
    }

    /**
     * A1: Split text into sentence-sized chunks for browser TTS.
     * Each chunk targets < 300 characters to stay well under the 30s timeout.
     */
    private splitBySentence(text: string): string[] {
        // Split on sentence-ending punctuation followed by space or end
        const sentences = text.match(/[^.!?]+[.!?]+[\s]?|[^.!?]+$/g) || [text];
        const chunks: string[] = [];
        let current = '';

        for (const sentence of sentences) {
            if ((current + sentence).length > 300 && current.length > 0) {
                chunks.push(current.trim());
                current = sentence;
            } else {
                current += sentence;
            }
        }
        if (current.trim()) chunks.push(current.trim());
        return chunks.length > 0 ? chunks : [text];
    }

    /** Speak a single chunk via browser SpeechSynthesis. */
    private speakSingleChunk(text: string, id: number): Promise<boolean> {
        return new Promise((resolve) => {
            if (id !== this.invId) { resolve(false); return; }

            // Safety timeout per chunk
            const safetyTimeout = setTimeout(() => {
                console.warn('[TTS] Browser TTS safety timeout (30s) per chunk — forcing resolve');
                resolve(false);
            }, 30_000);

            const utt = new SpeechSynthesisUtterance(text);
            utt.volume = 1.0;
            utt.rate = this._rate;
            utt.pitch = this._pitch;
            if (this._voice) utt.voice = this._voice;

            let started = false;
            utt.onstart = () => { started = true; };
            utt.onend = () => { clearTimeout(safetyTimeout); resolve(true); };
            utt.onerror = (e) => {
                clearTimeout(safetyTimeout);
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.warn('[TTS] Browser error:', e.error);
                }
                resolve(started); // If it started, some speech was heard
            };
            window.speechSynthesis.speak(utt);
        });
    }
}
