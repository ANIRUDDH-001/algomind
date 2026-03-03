/**
 * TTSEngine
 * Polly → Browser WebSpeech cascade.
 * Single <audio> element (not AudioContext) — iOS uses media volume correctly.
 * Invocation ID prevents race conditions (new speak() cancels previous).
 */
export type TTSProvider = 'polly' | 'browser';

export class TTSEngine {
    private audioEl: HTMLAudioElement | null = null;
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

    async speak(text: string, pollyEnabled: boolean): Promise<TTSProvider> {
        if (!text.trim()) { console.log('[TTS] Empty text, skipping'); return 'browser'; }
        console.log(`[TTS] speak() called, text length=${text.length}, pollyEnabled=${pollyEnabled}`);
        const id = ++this.invId;
        this.cancel();
        // Chrome bug: speechSynthesis.cancel() followed by immediate speak()
        // causes the new utterance to be silently discarded. A small delay lets
        // the cancel complete in Chrome's internal audio pipeline.
        await new Promise(r => setTimeout(r, 100));
        if (id !== this.invId) { console.log('[TTS] Cancelled by newer speak()'); return 'browser'; }
        this.setSpeaking(true);
        let used: TTSProvider = 'browser';
        try {
            if (pollyEnabled && id === this.invId) {
                const ok = await this.tryPolly(text, id);
                if (ok) { used = 'polly'; console.log('[TTS] Polly succeeded'); return used; }
                console.log('[TTS] Polly failed, falling back to browser');
            }
            if (id === this.invId) {
                console.log('[TTS] Starting browser TTS...');
                await this.tryBrowser(text, id);
                console.log('[TTS] Browser TTS completed');
            }
        } finally {
            if (id === this.invId) this.setSpeaking(false);
        }
        return used;
    }

    stop() {
        this.invId++;
        this.cancel();
        this._speaking = false;
        this.onSpeakingChange?.(false);
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
            const blob = new Blob([buf], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;
            this.audioEl = audio;
            audio.onended = () => { URL.revokeObjectURL(url); if (id === this.invId) this.audioEl = null; resolve(true); };
            audio.onerror = () => { URL.revokeObjectURL(url); if (id === this.invId) this.audioEl = null; resolve(false); };
            audio.play().catch(() => resolve(false));
        });
    }

    private tryBrowser(text: string, id: number): Promise<void> {
        return new Promise((resolve) => {
            if (typeof window === 'undefined' || !window.speechSynthesis || id !== this.invId) {
                console.warn('[TTS] Browser TTS unavailable or cancelled');
                resolve();
                return;
            }

            // Safety timeout: prevent stuck promise if utterance never fires onend/onerror
            const safetyTimeout = setTimeout(() => {
                console.warn('[TTS] Browser TTS safety timeout (30s) — forcing resolve');
                resolve();
            }, 30_000);

            const utt = new SpeechSynthesisUtterance(text);
            utt.volume = 1.0;
            utt.rate = this._rate;
            utt.pitch = this._pitch;
            if (this._voice) utt.voice = this._voice;
            console.log(`[TTS] Browser utterance: voice=${this._voice?.name ?? 'default'}, rate=${this._rate}, pitch=${this._pitch}, textLen=${text.length}`);

            utt.onstart = () => console.log('[TTS] Browser utterance started playing');
            utt.onend = () => { clearTimeout(safetyTimeout); console.log('[TTS] Browser utterance ended'); resolve(); };
            utt.onerror = (e) => {
                clearTimeout(safetyTimeout);
                if (e.error !== 'interrupted' && e.error !== 'canceled') {
                    console.warn('[TTS] Browser error:', e.error);
                }
                console.log(`[TTS] Browser utterance error: ${e.error}`);
                resolve();
            };
            window.speechSynthesis.speak(utt);
        });
    }
}
