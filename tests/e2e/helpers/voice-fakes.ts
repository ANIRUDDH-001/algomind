/**
 * @codesage
 * @file      tests/e2e/helpers/voice-fakes.ts
 * @purpose   Deterministic voice harness: fake Silero MicVAD, fake speechSynthesis (with Chrome's post-cancel drop), mocked voice APIs, prod-safety net.
 * @tech      Playwright
 * @connects  tests/e2e/voice-pipeline.spec.ts; app injection point window.mockMicVAD (lib/voice/vad-manager.ts)
 * @apis      mocks /api/flags, /api/chat, /api/voice/transcribe, /api/voice/telemetry
 * @db        none (Supabase host requests are answered locally)
 * @state     window.__fakeVad, window.__fakeSynth
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import type { Page, Route } from '@playwright/test';

/** Fake Silero MicVAD (via window.mockMicVAD) + fake speechSynthesis that reproduces Chrome's post-cancel drop. */
export async function installVoiceFakes(page: Page) {
    await page.addInitScript(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vad = { listening: false, starts: 0, pauses: 0, framesOn: true, opts: null as any, timer: 0 as any };
        w.__fakeVad = {
            state: vad,
            async speak(ms: number) {
                if (!vad.opts || !vad.listening) return false;
                vad.opts.onSpeechStart?.();
                await new Promise(r => setTimeout(r, ms));
                vad.opts.onSpeechEnd?.(new Float32Array(Math.round(16 * ms)));
                return true;
            },
            /** A late/stray VAD event pair delivered even though the VAD is paused (e.g. Kai's own voice). */
            forceSpeech(ms: number) {
                vad.opts?.onSpeechStart?.();
                vad.opts?.onSpeechEnd?.(new Float32Array(Math.round(16 * ms)));
            },
            killFrames() { vad.framesOn = false; },
        };
        w.mockMicVAD = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            new: async (opts: any) => {
                vad.opts = opts;
                return {
                    get listening() { return vad.listening; },
                    start: async () => {
                        vad.listening = true; vad.starts++; vad.framesOn = true;
                        clearInterval(vad.timer);
                        vad.timer = setInterval(() => { if (vad.listening && vad.framesOn) opts.onFrameProcessed?.({ isSpeech: 0.01 }); }, 32);
                    },
                    pause: async () => { vad.listening = false; vad.pauses++; },
                    destroy: async () => { vad.listening = false; clearInterval(vad.timer); },
                };
            },
        };

        const log = {
            spoken: [] as string[], dropped: 0, cancels: 0, speakAt: [] as number[], cancelAt: [] as number[],
            mode: 'normal' as 'normal' | 'cancel-first' | 'not-allowed',
            msPerChar: 2,   // raise to make Kai talk long enough to act mid-sentence
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = null; let lastCancel = -1e9;
        const voices = [{ name: 'Google US English', lang: 'en-US', default: true, localService: false, voiceURI: 'g' }];
        const synth = {
            get speaking() { return !!current; }, pending: false, paused: false,
            getVoices: () => voices,
            addEventListener: () => {}, removeEventListener: () => {},
            resume() {}, pause() {},
            cancel() { log.cancels++; lastCancel = performance.now(); log.cancelAt.push(lastCancel); const u = current; current = null; u?.onerror?.({ error: 'canceled' }); },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            speak(u: any) {
                if (performance.now() - lastCancel < 100) { log.dropped++; return; }   // Chrome behaviour
                if (u.volume === 0) return;                                            // unlock()
                if (log.mode === 'not-allowed') { setTimeout(() => u.onerror?.({ error: 'not-allowed' }), 0); return; }
                if (log.mode === 'cancel-first') { log.mode = 'normal'; setTimeout(() => u.onerror?.({ error: 'canceled' }), 5); return; }
                log.spoken.push(u.text); log.speakAt.push(performance.now()); current = u;
                setTimeout(() => u.onstart?.(), 10);
                setTimeout(() => { if (current === u) { current = null; u.onend?.(); } }, 60 + u.text.length * log.msPerChar);
            },
        };
        Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        w.SpeechSynthesisUtterance = class { lang = ''; voice = null; rate = 1; pitch = 1; volume = 1; onstart: any; onend: any; onerror: any; constructor(public text: string) {} };
        w.__fakeSynth = log;
        navigator.mediaDevices.getUserMedia = async () => new MediaStream();
    });
}

export interface VoiceApiLog {
    chat: Array<{ at: number; body: string }>;
    transcribe: number[];
    telemetry: Array<{ events: Array<{ turn: number; outcome: string; derived: { turnGapMs: number | null }; details: Record<string, unknown> }> }>;
    /** Non-GET /api calls the suite did not expect — answered locally, never sent to the server. */
    unexpectedWrites: string[];
}

/**
 * Deterministic backend: fixed transcripts, 3-sentence SSE replies, voice flag on/off.
 * Safety net FIRST (Playwright runs the most recently registered route first): anything bound for
 * the Supabase host is answered locally, and any non-GET /api call the suite didn't mock is
 * answered locally and recorded — the dev server talks to production, so nothing may write there.
 */
export async function mockVoiceApis(page: Page, o: { transcripts: string[]; sentences?: string[]; voiceOn?: boolean; chatDelayMs?: number }): Promise<VoiceApiLog> {
    const log: VoiceApiLog = { chat: [], transcribe: [], telemetry: [], unexpectedWrites: [] };
    let t = 0;
    const sentences = o.sentences ?? ['Good thinking.', 'What is the time complexity of that?', 'And how much extra space does it use?'];

    await page.route('**/*', (route: Route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.hostname.endsWith('.supabase.co')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (url.origin === 'http://localhost:3000' && url.pathname.startsWith('/api/') && req.method() !== 'GET') {
            log.unexpectedWrites.push(`${req.method()} ${url.pathname}`);
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        return route.fallback();
    });
    await page.route('**/api/flags', (route) => route.fulfill({
        json: {
            ENABLE_VOICE_MODE: { value: o.voiceOn ?? true, description: '' },
            ENABLE_WHISPER_STT: { value: true, description: '' },
            ENABLE_GUEST_MODE: { value: true, description: '' },
        },
    }));
    await page.route('**/api/voice/transcribe', (route) => {
        log.transcribe.push(Date.now());
        return route.fulfill({ json: { text: o.transcripts[Math.min(t++, o.transcripts.length - 1)], model: 'fake', confidence: 0.95, duration: 1.2, timing: { preMs: 5, groqMs: 50 } } });
    });
    await page.route('**/api/rag/context', (route) => route.fulfill({ json: { chunks: [] } }));
    await page.route('**/api/voice/telemetry', (route) => {
        try { log.telemetry.push(JSON.parse(route.request().postData() ?? '{}')); } catch { /* ignore */ }
        return route.fulfill({ status: 202, json: { accepted: 1 } });
    });
    await page.route('**/api/chat', async (route) => {
        log.chat.push({ at: Date.now(), body: route.request().postData() ?? '' });
        if (o.chatDelayMs) await new Promise(r => setTimeout(r, o.chatDelayMs));
        const body = sentences.map(s => `data: ${JSON.stringify({ delta: s + ' ' })}\n\n`).join('')
            + `data: ${JSON.stringify({ done: true, fullText: sentences.join(' ') })}\n\n`;
        return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body });
    });
    return log;
}

/**
 * A guest practice interview. The `playwright-e2e` cookie gets past the proxy's login redirect, and
 * `playwright-force-real-auth` stops AuthProvider from inventing a fake user — so the page runs the
 * pure client-side guest flow: no user id means no rate-limit server action, profile, memory or RAG
 * calls (a fake user id made the server action hit production Redis/Postgres and report a 0/5 limit).
 */
export async function openGuestInterview(page: Page, o: { voiceOn?: boolean } = {}) {
    await page.context().addCookies([{ name: 'playwright-e2e', value: 'true', url: 'http://localhost:3000' }]);
    await page.addInitScript(() => { localStorage.setItem('playwright-force-real-auth', '1'); });
    await page.goto('/interview');
    await page.locator('[data-testid^="problem-card-"]').first().click({ timeout: 60_000 });
    await page.locator('[data-testid="begin-interview-btn"]:visible').waitFor({ timeout: 30_000 });
    if (o.voiceOn ?? true) {
        // A first-time voice user gets the voice tutorial BEFORE Begin — never over Kai's greeting.
        const tutorial = page.getByRole('dialog', { name: /welcome to voice interviews/i });
        await tutorial.getByRole('button', { name: /got it/i }).click({ timeout: 15_000 });
        await tutorial.waitFor({ state: 'hidden' });
    }
}

/**
 * Flush the telemetry buffer while the mocks are still installed. Without this, the `pagehide`
 * that fires as Playwright closes the page could send a beacon after the routes are gone.
 */
export async function flushTelemetry(page: Page) {
    if (page.isClosed()) return;
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide'))).catch(() => {});
    await page.waitForTimeout(200);
}
