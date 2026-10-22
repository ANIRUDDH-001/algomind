/**
 * @codesage
 * @file      src/lib/voice/mic-controller.ts
 * @purpose   The ONLY owner of the microphone + Silero VAD. Serialized start/stop, self-healing, watchdog.
 * @tech      TypeScript
 * @connects  useVAD (React wrapper); vad-manager (createBrowserVad)
 * @apis      none
 * @db        none
 * @state     Desired intent + observed status
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { getVADManager, resetVADManager } from './vad-manager';
import { getVoiceConfig } from '@/config/voice-config';

export type MicIntent = 'listen' | 'mute' | 'off';
export type MicStatus = 'off' | 'starting' | 'listening' | 'muted' | 'recovering' | 'failed';
export interface VadHandle { start(): Promise<void>; pause(): Promise<void>; destroy(): Promise<void>; lastFrameAt(): number; }
export interface VadCallbacks {
    onSpeechStart(): void;
    onSpeechEnd(audio: Float32Array): void;
    onFrame(prob: number): void;
    /** Speech started but was too short to count (cough, click) — no onSpeechEnd follows. */
    onMisfire?(): void;
}
export type VadFactory = (cb: VadCallbacks) => Promise<VadHandle>;

interface Options {
    createVad: VadFactory;
    onStatus?(s: MicStatus, detail?: string): void;
    onSpeechStart?(): void;
    onSpeechEnd?(audio: Float32Array): void;
    onFrame?(prob: number): void;
    onMisfire?(): void;
    retryDelaysMs?: number[];
    watchdogMs?: number;
    now?(): number;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class MicController {
    private intent: MicIntent = 'off';
    private _status: MicStatus = 'off';
    private vad: VadHandle | null = null;
    private chain: Promise<void> = Promise.resolve();
    private watchdog: ReturnType<typeof setInterval> | null = null;
    private readonly retry: number[];
    private readonly watchdogMs: number;
    private readonly now: () => number;

    constructor(private o: Options) {
        this.retry = o.retryDelaysMs ?? [500, 1500, 4000];
        this.watchdogMs = o.watchdogMs ?? 4000;
        this.now = o.now ?? (() => Date.now());
    }

    get status(): MicStatus { return this._status; }

    setIntent(next: MicIntent): Promise<void> {
        this.intent = next;
        return this.serial(() => this.reconcile());
    }

    /** Re-check reality (tab visible, device plugged, user tapped retry). Also the only way out of 'failed'. */
    poke(reason: string): Promise<void> {
        if (this._status === 'failed' && this.intent === 'listen') this._status = 'off';
        console.info(`[PIPE][MIC] poke (${reason}) intent=${this.intent} status=${this._status}`);
        return this.serial(() => this.reconcile());
    }

    async dispose(): Promise<void> {
        this.intent = 'off';
        await this.serial(async () => { this.stopWatchdog(); await this.teardown(); this.setStatus('off'); });
    }

    private serial(op: () => Promise<void>): Promise<void> {
        this.chain = this.chain.then(op, op).catch(err => console.error('[PIPE][MIC] op failed', err));
        return this.chain;
    }

    private setStatus(s: MicStatus, detail?: string) {
        if (this._status === s) return;
        this._status = s;
        console.info(`[PIPE][MIC] status=${s}${detail ? ` (${detail})` : ''}`);
        this.o.onStatus?.(s, detail);
    }

    private async reconcile(): Promise<void> {
        if (this.intent === 'listen') {
            if (this._status === 'failed') return;              // wait for poke()
            if (this._status === 'listening' && this.vad) return;
            await this.startWithRetry();
            return;
        }
        this.stopWatchdog();
        if (this.vad && (this._status === 'listening' || this._status === 'starting' || this._status === 'recovering')) {
            try { await this.vad.pause(); } catch { /* pausing a dead VAD is fine */ }
        }
        this.setStatus(this.intent === 'mute' ? 'muted' : 'off');
    }

    private async startWithRetry(): Promise<void> {
        for (let attempt = 0; ; attempt++) {
            this.setStatus(attempt === 0 ? 'starting' : 'recovering');
            try {
                if (!this.vad) this.vad = await this.o.createVad(this.callbacks());
                await this.vad.start();
                if (this.intent !== 'listen') { await this.vad.pause(); await this.reconcile(); return; }
                this.setStatus('listening');
                this.startWatchdog();
                return;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.warn(`[PIPE][MIC] start failed (attempt ${attempt + 1}): ${msg}`);
                await this.teardown();
                if (attempt >= this.retry.length) { this.setStatus('failed', msg); return; }
                await sleep(this.retry[attempt]);
                if (this.intent !== 'listen') { await this.reconcile(); return; }
            }
        }
    }

    private callbacks(): VadCallbacks {
        return {
            onSpeechStart: () => { if (this.intent === 'listen') this.o.onSpeechStart?.(); },
            onSpeechEnd: (audio) => this.o.onSpeechEnd?.(audio),   // includes the submit-on-pause tail
            onFrame: (p) => this.o.onFrame?.(p),
            onMisfire: () => this.o.onMisfire?.(),
        };
    }

    private async teardown(): Promise<void> {
        const v = this.vad; this.vad = null;
        if (v) { try { await v.destroy(); } catch { /* ignore */ } }
    }

    private startWatchdog() {
        this.stopWatchdog();
        this.watchdog = setInterval(() => {
            if (this._status !== 'listening' || !this.vad) return;
            if (this.now() - this.vad.lastFrameAt() > this.watchdogMs) {
                console.warn('[PIPE][MIC] watchdog: no VAD frames — restarting mic');
                void this.serial(async () => { this.stopWatchdog(); await this.teardown(); this.setStatus('recovering'); await this.reconcile(); });
            }
        }, 1000);
    }

    private stopWatchdog() { if (this.watchdog) { clearInterval(this.watchdog); this.watchdog = null; } }
}

/** Real implementation: a fresh VADManager per (re)start — never reuses one that may be broken. */
export const createBrowserVad: VadFactory = async (cb) => {
    await resetVADManager();
    const mgr = getVADManager();
    const unsubs = [mgr.onSpeechStart(cb.onSpeechStart), mgr.onSpeechEnd(cb.onSpeechEnd), mgr.onFrameProcessed(cb.onFrame)];
    if (cb.onMisfire) unsubs.push(mgr.onMisfire(cb.onMisfire));
    // Live tuning values (defaults + admin localStorage overrides) — init() alone would use
    // VADManager's hard-coded defaults. Redemption comes from vadSilenceWindowMs inside init().
    const vc = getVoiceConfig();
    try {
        await mgr.init({
            positiveSpeechThreshold: vc.vadPositiveSpeechThreshold,
            negativeSpeechThreshold: vc.vadNegativeSpeechThreshold,
            minSpeechMs: vc.vadMinSpeechMs,
        });
    } catch (e) {
        unsubs.forEach(u => u());
        throw e;
    }
    return {
        start: () => mgr.start(),
        pause: () => mgr.stop(),
        destroy: async () => { unsubs.forEach(u => u()); await mgr.destroy(); },
        lastFrameAt: () => mgr.lastFrameAt,
    };
};
