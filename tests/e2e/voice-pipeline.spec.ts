/**
 * @codesage
 * @file      tests/e2e/voice-pipeline.spec.ts
 * @purpose   Deterministic voice regression suite: turn commit timing, mid-thought pause, mute, cancel race, tab switch, echo guard, blocked speaker, voice off, telemetry.
 * @tech      Playwright (Chromium), fake MicVAD + fake speechSynthesis
 * @connects  tests/e2e/helpers/voice-fakes.ts; /interview guest flow (InterviewSession + useInterview)
 * @apis      all mocked (see voice-fakes.ts mockVoiceApis)
 * @db        none
 * @state     none
 * @env       PW_VOICE_CHANNEL=chrome (optional), DEBUG_VOICE_E2E=1 (optional request/console log)
 * @issues    none
 * @audit     CODESAGE-v1
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- page.evaluate reaches the untyped fakes on window */
import { test, expect, type Page } from '@playwright/test';
import { installVoiceFakes, mockVoiceApis, openGuestInterview, flushTelemetry, type VoiceApiLog } from './helpers/voice-fakes';

interface FakeVadState { listening: boolean; starts: number; pauses: number; framesOn: boolean; opts: unknown }
interface FakeSynthLog { spoken: string[]; dropped: number; cancels: number; speakAt: number[]; cancelAt: number[] }

const vad = (page: Page) => page.evaluate(() => { const s = (window as any).__fakeVad.state; return { ...s, opts: s.opts ? 'set' : null } as FakeVadState; });
const synth = (page: Page) => page.evaluate(() => (window as any).__fakeSynth as FakeSynthLog);
const speak = (page: Page, ms: number) => page.evaluate((d) => (window as any).__fakeVad.speak(d), ms);
const kaiTalking = (page: Page) => page.evaluate(() => window.speechSynthesis.speaking);
const listening = async (page: Page) => (await vad(page)).listening;

const REPLY = ['Good thinking.', 'What is the time complexity of that?', 'And how much extra space does it use?'];

async function begin(page: Page) {
    await page.locator('[data-testid="begin-interview-btn"]:visible').click();
}
/** Begin, let Kai finish the guest welcome + intro, and wait for the mic to arm. */
async function beginAndWaitForMic(page: Page) {
    await begin(page);
    await expect.poll(() => listening(page), { timeout: 20_000 }).toBe(true);
}
async function setTabVisibility(page: Page, v: 'hidden' | 'visible') {
    await page.evaluate((state) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
    }, v);
}

test.describe('voice pipeline', () => {
    let api: VoiceApiLog | null = null;

    test.beforeEach(async ({ page }) => {
        api = null;
        await installVoiceFakes(page);
        if (process.env.DEBUG_VOICE_E2E) {
            page.on('request', r => { if (r.url().includes('/api/') || r.url().includes('supabase')) console.log('[req]', r.method(), r.url().slice(0, 120)); });
            page.on('console', m => { if (/PIPE|rror/.test(m.text())) console.log('[page]', m.type(), m.text().slice(0, 200)); });
        }
    });
    test.afterEach(async ({ page }) => {
        await flushTelemetry(page);
        // The dev server talks to production: nothing the suite didn't mock may have been written.
        expect(api?.unexpectedWrites ?? []).toEqual([]);
    });

    test('(a) Happy turn: commit without the 5 s wait, sentences in order, mic re-arms', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['I would use a hash map to store the complements.'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);

        const chatsBefore = api.chat.length;
        const t0 = Date.now();
        await speak(page, 1200);
        await expect.poll(() => api!.chat.length, { timeout: 6_000 }).toBe(chatsBefore + 1);
        expect(api.chat[chatsBefore].at - t0).toBeLessThan(1200 + 1500);

        await expect.poll(async () => (await synth(page)).spoken.slice(-3)).toEqual(REPLY);
        await expect.poll(() => listening(page), { timeout: 3_000 }).toBe(true);
        expect((await synth(page)).dropped).toBe(0);
    });

    test('(a2) Pause mid-thought: an unfinished sentence waits, and both halves go to Kai as ONE turn', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['So the approach would be.', 'to use a hash map for the complements.'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);

        const chatsBefore = api.chat.length;
        await speak(page, 1000);
        await expect.poll(() => api!.transcribe.length).toBe(1);
        await page.waitForTimeout(1_500);                       // well past the 900 ms "complete" rule
        expect(api.chat.length).toBe(chatsBefore);             // …but "would be" is unfinished (2.8 s rule)

        await speak(page, 800);                                 // the candidate carries on
        await expect.poll(() => api!.chat.length, { timeout: 6_000 }).toBe(chatsBefore + 1);
        const prompt = api.chat[chatsBefore].body;
        expect(prompt).toContain('So the approach would be');
        expect(prompt).toContain('to use a hash map for the complements.');
        await page.waitForTimeout(3_000);
        expect(api.chat.length).toBe(chatsBefore + 1);         // never split into two turns
    });

    test('(b) Mute holds: the mic pauses at once and stays off through a whole Kai reply', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['I would sort the array first.'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);
        const mic = page.locator('[data-testid="mic-button"]:visible');

        const t0 = Date.now();
        await mic.click();
        await expect.poll(() => listening(page), { timeout: 1_000, intervals: [25] }).toBe(false);
        expect(Date.now() - t0).toBeLessThan(800);
        await expect(mic).toHaveAttribute('aria-label', /unmute/i);

        await mic.click();                                      // unmute, answer, then mute while Kai replies
        await expect.poll(() => listening(page), { timeout: 3_000 }).toBe(true);
        const chatsBefore = api.chat.length;
        await speak(page, 1000);
        await expect.poll(() => api!.chat.length, { timeout: 6_000 }).toBe(chatsBefore + 1);
        await mic.click();
        await expect.poll(async () => (await synth(page)).spoken.slice(-3)).toEqual(REPLY);
        const startsAfterReply = (await vad(page)).starts;
        await page.waitForTimeout(1_500);
        expect(await listening(page)).toBe(false);              // the post-reply auto re-arm respected mute
        expect((await vad(page)).starts).toBe(startsAfterReply);
        await expect(mic).toHaveAttribute('aria-label', /unmute/i);

        await mic.click();
        await expect.poll(() => listening(page), { timeout: 3_000 }).toBe(true);
    });

    test('(c) Cancel race: a first utterance that errors "canceled" stalls neither Kai nor the mic, and nothing is dropped', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['unused'] });
        await openGuestInterview(page);
        await page.evaluate(() => { (window as any).__fakeSynth.mode = 'cancel-first'; });
        await begin(page);

        await expect.poll(async () => (await synth(page)).spoken.slice(-3), { timeout: 20_000 }).toEqual(REPLY);
        await expect.poll(() => kaiTalking(page)).toBe(false);
        await expect.poll(() => listening(page), { timeout: 1_000 }).toBe(true);
        const s = await synth(page);
        expect(s.dropped).toBe(0);
        for (const c of s.cancelAt) expect(s.speakAt.some(t => t > c && t - c < 100)).toBe(false);
    });

    test('(d) Tab hidden then visible: the mic comes back by itself within 1.5 s', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['unused'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);

        await page.evaluate(() => (window as any).__fakeVad.killFrames());  // a background tab's audio graph stalls
        await setTabVisibility(page, 'hidden');
        await expect.poll(() => listening(page)).toBe(false);
        await page.waitForTimeout(1_000);

        await setTabVisibility(page, 'visible');
        await expect.poll(() => listening(page), { timeout: 1_500 }).toBe(true);
        expect((await vad(page)).framesOn).toBe(true);
    });

    test('(e) Echo guard: VAD events that arrive while Kai is speaking are not transcribed and do not cut Kai off', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['I would use two pointers.', 'SHOULD NEVER BE TRANSCRIBED'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);

        await page.evaluate(() => { (window as any).__fakeSynth.msPerChar = 40; }); // ~1.5 s per sentence
        await speak(page, 1000);
        await expect.poll(() => api!.transcribe.length).toBe(1);
        await expect.poll(() => kaiTalking(page), { timeout: 6_000 }).toBe(true);
        const cancelsBefore = (await synth(page)).cancels;

        await page.evaluate(() => (window as any).__fakeVad.forceSpeech(900)); // Kai's own voice leaking into the mic
        await page.waitForTimeout(800);
        expect(api.transcribe.length).toBe(1);
        expect((await synth(page)).cancels).toBe(cancelsBefore);
        await expect.poll(async () => (await synth(page)).spoken.slice(-3), { timeout: 10_000 }).toEqual(REPLY);
    });

    test('(f) Blocked speaker: the "tap to enable" banner appears, and tapping it speaks Kai again', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['unused'] });
        await openGuestInterview(page);
        await page.evaluate(() => { (window as any).__fakeSynth.mode = 'not-allowed'; });
        await begin(page);

        const banner = page.getByRole('button', { name: /voice is blocked by the browser/i });
        await expect(banner).toBeVisible({ timeout: 15_000 });
        await expect.poll(() => api!.chat.length, { timeout: 15_000 }).toBe(1);   // Kai's intro exists as text
        await page.waitForTimeout(300);
        await page.evaluate(() => { (window as any).__fakeSynth.mode = 'normal'; });
        const spokenBefore = (await synth(page)).spoken.length;

        await banner.click();
        await expect.poll(async () => (await synth(page)).spoken.length).toBeGreaterThan(spokenBefore);
        expect((await synth(page)).spoken.at(-1)).toContain('Good thinking.');
        await expect(banner).toBeHidden();
    });

    test('(g) Voice off: typed chat only — composer shown, nothing spoken, mic never started', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['unused'], voiceOn: false });
        await openGuestInterview(page, { voiceOn: false });
        await begin(page);

        const box = page.locator('textarea[aria-label="Your answer"]:visible');
        await expect(box).toBeEnabled({ timeout: 15_000 });
        await expect(page.getByRole('dialog')).toHaveCount(0);   // no voice tutorial trapping focus in text mode
        await expect.poll(() => api!.chat.length).toBe(1);
        await box.fill('I would use a hash map.');
        await page.locator('button[aria-label="Send"]:visible').click();
        await expect.poll(() => api!.chat.length, { timeout: 6_000 }).toBe(2);
        expect(api.chat[1].body).toContain('I would use a hash map.');
        await page.waitForTimeout(1_000);

        expect((await synth(page)).spoken).toEqual([]);
        const v = await vad(page);
        expect(v.starts).toBe(0);
        expect(v.opts).toBeNull();                              // the VAD was never even created
    });

    test('(h) Telemetry: one batched POST carries the turn timelines, with a measured turn gap', async ({ page }) => {
        api = await mockVoiceApis(page, { transcripts: ['I would use a hash map to store the complements.'] });
        await openGuestInterview(page);
        await beginAndWaitForMic(page);
        await speak(page, 1200);
        await expect.poll(async () => (await synth(page)).spoken.slice(-3), { timeout: 8_000 }).toEqual(REPLY);
        await expect.poll(() => listening(page), { timeout: 3_000 }).toBe(true);
        expect(api.telemetry).toHaveLength(0);                  // batched, not one request per turn

        await flushTelemetry(page);
        await expect.poll(() => api!.telemetry.length).toBe(1);
        const events = api.telemetry[0].events;
        expect(events.find(e => e.turn === 0)?.outcome).toBe('spoken');
        const turn1 = events.find(e => e.turn === 1);
        expect(turn1?.outcome).toBe('spoken');
        expect(typeof turn1?.derived.turnGapMs).toBe('number');
        expect(turn1!.derived.turnGapMs!).toBeLessThan(3_000);
    });
});
