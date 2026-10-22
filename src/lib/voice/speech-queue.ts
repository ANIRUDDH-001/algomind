/**
 * @codesage
 * @file      src/lib/voice/speech-queue.ts
 * @purpose   The ONLY owner of window.speechSynthesis: ordered sentence queue, no cancel→speak race, English voice guarantee, watchdog.
 * @tech      Web Speech API (SpeechSynthesis)
 * @connects  useTTS, tour, VoiceSettings preview — nothing else may call speechSynthesis directly (ESLint-enforced)
 * @apis      none
 * @db        none
 * @state     window singleton
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { pickEnglishVoice } from './voice-utils';
import { preprocessForTTS } from './tts-preprocessor';

export type SpeechQueueEvent =
    | { type: 'speaking'; value: boolean }
    | { type: 'first-audio'; latencyMs: number; voice: string | null }
    | { type: 'error'; code: string }
    | { type: 'blocked' };

interface Deps { synth: SpeechSynthesis; Utterance: typeof SpeechSynthesisUtterance; }

const CANCEL_SETTLE_MS = 250;   // Chrome drops speak() issued right after cancel()
const VOICES_TIMEOUT_MS = 1500;
const MAX_CHARS = 200;          // Chrome network voices stop after ~15 s
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function sanitize(text: string): string {
    return preprocessForTTS(text ?? '')
        .replace(/\$\$?([^$]*)\$\$?/g, '$1')
        .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
        .replace(/\^2\b/g, ' squared').replace(/\^3\b/g, ' cubed')
        .replace(/\bO\(([^)]+)\)/g, 'O of $1')
        .replace(/[`*_#>~$]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function splitForChrome(text: string): string[] {
    const out: string[] = [];
    let rest = text;
    while (rest.length > MAX_CHARS) {
        const win = rest.slice(0, MAX_CHARS);
        const comma = Math.max(win.lastIndexOf(', '), win.lastIndexOf('; '), win.lastIndexOf(': '));
        const at = comma > 40 ? comma + 1 : Math.max(win.lastIndexOf(' '), 1);
        out.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
    return out;
}

/** ~14 chars/s at rate 1 — used only for the watchdog. */
const estimateMs = (text: string, rate: number) => (text.length / 14) * 1000 / Math.max(rate, 0.5);

export class SpeechQueue {
    private queue: string[] = [];
    private current: SpeechSynthesisUtterance | null = null;
    private generation = 0;
    private settleUntil = 0;
    private voice: SpeechSynthesisVoice | null = null;
    private voicesReady: Promise<void>;
    private preferredVoiceName: string | null = null;
    private rate = 1;
    private pitch = 1;
    private firstAudioFrom: number | null = null;
    private listeners = new Set<(e: SpeechQueueEvent) => void>();
    private idleWaiters: Array<() => void> = [];
    private pumping = false;
    private reportedNoEnglish = false;
    private announcedSpeaking = false;   // guarantees exactly one speaking:true / speaking:false pair

    constructor(private deps: Deps) {
        this.voicesReady = this.waitForVoices();
        // Persistent listener via addEventListener — never clobbers other owners (was: onvoiceschanged =).
        deps.synth.addEventListener?.('voiceschanged', () => {
            this.voice = pickEnglishVoice(deps.synth.getVoices(), this.preferredVoiceName) ?? this.voice;
        });
    }

    get speaking(): boolean { return this.current !== null || this.queue.length > 0; }

    on(fn: (e: SpeechQueueEvent) => void): () => void {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    }

    private emit(e: SpeechQueueEvent) {
        this.listeners.forEach(fn => { try { fn(e); } catch { /* a listener bug must not break audio */ } });
    }

    configure(o: { preferredVoiceName?: string | null; rate?: number; pitch?: number }) {
        if (o.preferredVoiceName !== undefined) {
            this.preferredVoiceName = o.preferredVoiceName;
            this.voice = pickEnglishVoice(this.deps.synth.getVoices(), o.preferredVoiceName);
        }
        if (o.rate !== undefined) this.rate = Math.max(0.5, Math.min(2, o.rate));
        if (o.pitch !== undefined) this.pitch = Math.max(0.5, Math.min(2, o.pitch));
    }

    enqueue(text: string): void {
        const clean = sanitize(text);
        if (!clean) return;
        this.queue.push(...splitForChrome(clean));
        if (!this.announcedSpeaking) {
            this.announcedSpeaking = true;
            this.firstAudioFrom = now();
            this.emit({ type: 'speaking', value: true });
        }
        void this.pump();
    }

    whenIdle(): Promise<void> {
        if (!this.speaking) return Promise.resolve();
        return new Promise(r => this.idleWaiters.push(r));
    }

    stop(): void {
        const hadAudio = this.current !== null || this.deps.synth.speaking || this.deps.synth.pending;
        this.generation++;
        this.queue = [];
        this.current = null;
        if (hadAudio) {
            this.deps.synth.cancel();
            this.settleUntil = now() + CANCEL_SETTLE_MS;
        }
        this.becomeIdle();
    }

    /** Satisfies Chrome's user-activation rule. Call synchronously inside a click handler. */
    unlock(): void {
        try {
            const u = new this.deps.Utterance(' ');
            u.volume = 0;
            this.deps.synth.speak(u);
        } catch { /* ignore */ }
    }

    private becomeIdle() {
        if (this.speaking || !this.announcedSpeaking) return;
        this.announcedSpeaking = false;
        this.firstAudioFrom = null;
        this.emit({ type: 'speaking', value: false });
        const waiters = this.idleWaiters;
        this.idleWaiters = [];
        waiters.forEach(w => w());
    }

    private waitForVoices(): Promise<void> {
        return new Promise<void>((resolve) => {
            const synth = this.deps.synth;
            const done = () => { this.voice = pickEnglishVoice(synth.getVoices(), this.preferredVoiceName); resolve(); };
            if (synth.getVoices().length > 0) { done(); return; }
            const onChange = () => {
                if (synth.getVoices().length === 0) return;
                synth.removeEventListener?.('voiceschanged', onChange);
                clearTimeout(timer);
                done();
            };
            synth.addEventListener?.('voiceschanged', onChange);
            const timer = setTimeout(() => { synth.removeEventListener?.('voiceschanged', onChange); done(); }, VOICES_TIMEOUT_MS);
        });
    }

    private async pump(): Promise<void> {
        if (this.pumping) return;
        this.pumping = true;
        try {
            while (!this.current && this.queue.length > 0) {
                const gen = this.generation;
                await this.voicesReady;
                const wait = this.settleUntil - now();
                if (wait > 0) await sleep(wait);
                if (gen !== this.generation || this.current || this.queue.length === 0) continue;
                await this.speakOne(this.queue.shift()!, gen);
            }
        } finally {
            this.pumping = false;
        }
    }

    /** Resolves when this utterance ends, errors, or the watchdog fires. */
    private speakOne(text: string, gen: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const utt = new this.deps.Utterance(text);
            if (!this.voice && !this.reportedNoEnglish) {
                this.reportedNoEnglish = true;
                this.emit({ type: 'error', code: 'no-english-voice' });
            }
            utt.lang = this.voice?.lang ?? 'en-US';
            if (this.voice) utt.voice = this.voice;
            utt.rate = this.rate;
            utt.pitch = this.pitch;
            utt.volume = 1;
            this.current = utt;

            let settled = false;
            const finish = (outcome: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(watchdog);
                if (this.current === utt) this.current = null;
                if (outcome === 'watchdog') {
                    this.deps.synth.cancel();
                    this.settleUntil = now() + CANCEL_SETTLE_MS;
                }
                if (!this.speaking) this.becomeIdle();
                resolve();
            };
            const watchdog = setTimeout(() => {
                this.emit({ type: 'error', code: 'watchdog' });
                finish('watchdog');
            }, estimateMs(text, this.rate) * 2 + 4000);

            utt.onstart = () => {
                if (this.firstAudioFrom !== null) {
                    this.emit({ type: 'first-audio', latencyMs: Math.round(now() - this.firstAudioFrom), voice: this.voice?.name ?? null });
                    this.firstAudioFrom = null;
                }
            };
            utt.onend = () => finish('end');
            utt.onerror = (e: SpeechSynthesisErrorEvent | { error: string }) => {
                const code = e.error;
                // A cancel we caused ourselves (stop() or the watchdog) is not an error.
                if ((code === 'canceled' || code === 'interrupted') && (gen !== this.generation || this.current !== utt || settled)) {
                    finish('stopped');
                    return;
                }
                if (code === 'not-allowed') {
                    this.queue = [];
                    this.emit({ type: 'blocked' });
                } else {
                    this.emit({ type: 'error', code });
                }
                finish(code);
            };
            try { this.deps.synth.resume(); } catch { /* noop */ }
            console.info(`[PIPE][TTS] utter len=${text.length} voice=${this.voice?.name ?? 'lang:en-US'}`);
            this.deps.synth.speak(utt);
        });
    }
}

export function getSpeechQueue(): SpeechQueue {
    const w = window as unknown as { __ALGOMIND_SPEECH_QUEUE__?: SpeechQueue };
    if (!w.__ALGOMIND_SPEECH_QUEUE__) {
        w.__ALGOMIND_SPEECH_QUEUE__ = new SpeechQueue({ synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance });
    }
    return w.__ALGOMIND_SPEECH_QUEUE__;
}
