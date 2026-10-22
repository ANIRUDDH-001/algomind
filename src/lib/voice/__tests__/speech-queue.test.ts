/**
 * @codesage
 * @file      src/lib/voice/__tests__/speech-queue.test.ts
 * @purpose   SpeechQueue — ordered sentences, no cancel→speak race, English voice guarantee, watchdog.
 * @tech      Vitest (fake timers + a fake SpeechSynthesis that reproduces Chrome's post-cancel drop)
 * @connects  ../speech-queue, ../voice-utils
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechQueue } from '../speech-queue';
import { pickEnglishVoice } from '../voice-utils';

type Utt = {
    text: string; lang: string; voice: SpeechSynthesisVoice | null; rate: number; pitch: number; volume: number;
    onstart: (() => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
};

const voice = (name: string, lang: string, isDefault = false) =>
    ({ name, lang, default: isDefault, localService: true, voiceURI: name }) as SpeechSynthesisVoice;

/** Mimics Chrome: speak() within 100 ms of cancel() is silently dropped (no events). */
class FakeSynth {
    voices: SpeechSynthesisVoice[] = [];
    spoken: Utt[] = [];
    dropped: Utt[] = [];
    current: Utt | null = null;
    lastCancelAt = -Infinity;
    notAllowed = false;
    speaking = false; pending = false; paused = false;
    private listeners = new Set<() => void>();
    getVoices() { return this.voices; }
    addEventListener(_: 'voiceschanged', fn: () => void) { this.listeners.add(fn); }
    removeEventListener(_: 'voiceschanged', fn: () => void) { this.listeners.delete(fn); }
    fireVoicesChanged() { this.listeners.forEach(fn => fn()); }
    resume() { /* noop */ }
    speak(u: Utt) {
        if (Date.now() - this.lastCancelAt < 100) { this.dropped.push(u); return; }
        if (this.notAllowed) { setTimeout(() => u.onerror?.({ error: 'not-allowed' }), 0); return; }
        this.spoken.push(u); this.current = u; this.speaking = true;
        setTimeout(() => u.onstart?.(), 5);
    }
    finishCurrent() { const u = this.current; this.current = null; this.speaking = false; u?.onend?.(); }
    cancel() { this.lastCancelAt = Date.now(); const u = this.current; this.current = null; this.speaking = false; u?.onerror?.({ error: 'canceled' }); }
}

class FakeUtterance implements Utt {
    lang = ''; voice: SpeechSynthesisVoice | null = null; rate = 1; pitch = 1; volume = 1;
    onstart = null; onend = null; onerror = null;
    constructor(public text: string) {}
}

const make = (synth: FakeSynth) => new SpeechQueue({
    synth: synth as unknown as SpeechSynthesis,
    Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
});

describe('SpeechQueue', () => {
    let synth: FakeSynth;
    beforeEach(() => { vi.useFakeTimers(); synth = new FakeSynth(); synth.voices = [voice('Google US English', 'en-US')]; });
    afterEach(() => vi.useRealTimers());

    it('speaks queued sentences in order, one at a time', async () => {
        const q = make(synth);
        q.enqueue('First sentence here.'); q.enqueue('Second sentence here.');
        await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken.map(u => u.text)).toEqual(['First sentence here.']);
        synth.finishCurrent(); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken.map(u => u.text)).toEqual(['First sentence here.', 'Second sentence here.']);
    });

    it("never speaks inside Chrome's post-cancel window (the live-run bug)", async () => {
        const q = make(synth);
        q.enqueue('Old reply sentence.'); await vi.advanceTimersByTimeAsync(10);
        q.stop();
        q.enqueue('New reply sentence.'); await vi.advanceTimersByTimeAsync(400);
        expect(synth.dropped).toHaveLength(0);
        expect(synth.spoken.at(-1)?.text).toBe('New reply sentence.');
    });

    it('does not report an error for the cancel it caused itself', async () => {
        const q = make(synth); const events: string[] = [];
        q.on(e => events.push(e.type));
        q.enqueue('Some sentence to stop.'); await vi.advanceTimersByTimeAsync(10);
        q.stop(); await vi.advanceTimersByTimeAsync(10);
        expect(events).not.toContain('error');
    });

    it('emits exactly one speaking:true and one speaking:false per burst', async () => {
        const q = make(synth); const flips: boolean[] = [];
        q.on(e => { if (e.type === 'speaking') flips.push(e.value); });
        q.enqueue('One sentence here.'); q.enqueue('Two sentence here.');
        await vi.advanceTimersByTimeAsync(10); synth.finishCurrent();
        await vi.advanceTimersByTimeAsync(10); synth.finishCurrent();
        await vi.advanceTimersByTimeAsync(10);
        q.stop();
        expect(flips).toEqual([true, false]);
    });

    it('always sets an English lang/voice even when the OS default voice is Hindi', async () => {
        synth.voices = [voice('Microsoft Hemant - Hindi (India)', 'hi-IN', true), voice('Microsoft Zira - English (United States)', 'en-US')];
        const q = make(synth);
        q.enqueue('Hello there candidate.'); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].voice?.lang).toBe('en-US');
        expect(synth.spoken[0].lang).toBe('en-US');
    });

    it('waits for late-loading voices before the first utterance', async () => {
        synth.voices = [];
        const q = make(synth);
        q.enqueue('Late voices sentence.'); await vi.advanceTimersByTimeAsync(200);
        expect(synth.spoken).toHaveLength(0);
        synth.voices = [voice('Google UK English Female', 'en-GB')]; synth.fireVoicesChanged();
        await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].voice?.name).toBe('Google UK English Female');
    });

    it('falls back to lang=en-US and emits no-english-voice when no English voice exists', async () => {
        synth.voices = [voice('Hindi', 'hi-IN', true)];
        const q = make(synth); const codes: string[] = [];
        q.on(e => { if (e.type === 'error') codes.push(e.code); });
        q.enqueue('Anything at all here.'); await vi.advanceTimersByTimeAsync(10);
        expect(codes).toContain('no-english-voice');
        expect(synth.spoken[0].lang).toBe('en-US');
        expect(synth.spoken[0].voice).toBeNull();
    });

    it('emits blocked on not-allowed (needs a user gesture) and goes idle', async () => {
        synth.notAllowed = true;
        const q = make(synth); const types: string[] = [];
        q.on(e => types.push(e.type));
        q.enqueue('Blocked sentence here.'); await vi.advanceTimersByTimeAsync(10);
        expect(types).toContain('blocked');
        expect(q.speaking).toBe(false);
    });

    it('watchdog recovers when an utterance never ends', async () => {
        const q = make(synth); const codes: string[] = [];
        q.on(e => { if (e.type === 'error') codes.push(e.code); });
        q.enqueue('Stuck.'); q.enqueue('Next one after stuck.');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(codes).toContain('watchdog');
        expect(codes).not.toContain('canceled'); // the watchdog's own cancel is not an error
        expect(synth.spoken.at(-1)?.text).toBe('Next one after stuck.');
        expect(synth.dropped).toHaveLength(0);
    });

    it('splits sentences longer than 200 chars (Chrome ~15s cut-off) at commas', async () => {
        const q = make(synth);
        const long = 'a'.repeat(120) + ', ' + 'b'.repeat(120) + '.';
        q.enqueue(long); await vi.advanceTimersByTimeAsync(10);
        expect(synth.spoken[0].text.length).toBeLessThanOrEqual(200);
    });

    it('whenIdle resolves after the last utterance ends', async () => {
        const q = make(synth); let idle = false;
        q.enqueue('Only sentence here.'); void q.whenIdle().then(() => { idle = true; });
        await vi.advanceTimersByTimeAsync(10); expect(idle).toBe(false);
        synth.finishCurrent(); await vi.advanceTimersByTimeAsync(10); expect(idle).toBe(true);
    });

    it('reports first-audio latency once per burst', async () => {
        const q = make(synth); const lat: number[] = [];
        q.on(e => { if (e.type === 'first-audio') lat.push(e.latencyMs); });
        q.enqueue('One sentence here.'); q.enqueue('Two sentence here.');
        await vi.advanceTimersByTimeAsync(10); synth.finishCurrent(); await vi.advanceTimersByTimeAsync(10);
        expect(lat).toHaveLength(1);
    });
});

describe('pickEnglishVoice', () => {
    it('prefers natural/Google voices, then en-US, en-GB, en-IN, never non-English', () => {
        const vs = [voice('Hindi', 'hi-IN', true), voice('Microsoft David', 'en-US'), voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US')];
        expect(pickEnglishVoice(vs)?.name).toContain('Natural');
        expect(pickEnglishVoice([voice('Hindi', 'hi-IN', true)])).toBeNull();
        expect(pickEnglishVoice(vs, 'Microsoft David')?.name).toBe('Microsoft David');
        expect(pickEnglishVoice(vs, 'Hindi')?.lang.startsWith('en')).toBe(true);
    });
});
