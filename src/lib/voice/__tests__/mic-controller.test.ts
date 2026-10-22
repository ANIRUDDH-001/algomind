/**
 * @codesage
 * @file      src/lib/voice/__tests__/mic-controller.test.ts
 * @purpose   MicController — serialized mic/VAD ownership: no deferred-stop race, self-healing retries, watchdog, mute.
 * @tech      Vitest (fake timers)
 * @connects  ../mic-controller
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MicController, type VadCallbacks, type VadHandle } from '../mic-controller';

function fakeVadFactory() {
    const state = { listening: false, starts: 0, pauses: 0, destroys: 0, failStartsRemaining: 0, lastFrame: 0, created: 0 };
    let cb: VadCallbacks | null = null;
    const factory = vi.fn(async (c: VadCallbacks): Promise<VadHandle> => {
        cb = c; state.created++;
        return {
            start: async () => { state.starts++; if (state.failStartsRemaining > 0) { state.failStartsRemaining--; throw new Error('NotReadableError'); } state.listening = true; state.lastFrame = Date.now(); },
            pause: async () => { state.pauses++; state.listening = false; },
            destroy: async () => { state.destroys++; state.listening = false; },
            lastFrameAt: () => state.lastFrame,
        };
    });
    return { factory, state, cb: () => cb! };
}

describe('MicController', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('stop→start within 50ms ends LISTENING (regression: deferred-stop race)', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory });
        await mic.setIntent('listen');
        void mic.setIntent('off');
        await vi.advanceTimersByTimeAsync(50);
        await mic.setIntent('listen');
        await vi.advanceTimersByTimeAsync(5_000); // any stray timer would pause it here
        expect(mic.status).toBe('listening');
        expect(f.state.listening).toBe(true);
        await mic.dispose();
    });

    it('recovers from a start failure with backoff', async () => {
        const f = fakeVadFactory(); f.state.failStartsRemaining = 2;
        const statuses: string[] = [];
        const mic = new MicController({ createVad: f.factory, retryDelaysMs: [100, 200, 400], onStatus: s => statuses.push(s) });
        const p = mic.setIntent('listen');
        await vi.advanceTimersByTimeAsync(1_000); await p;
        expect(mic.status).toBe('listening');
        expect(statuses).toContain('recovering');
        expect(f.state.created).toBeGreaterThanOrEqual(2); // fresh VAD after failure, never a sticky ERROR
        await mic.dispose();
    });

    it('reports failed after retries are exhausted, and a poke retries again', async () => {
        const f = fakeVadFactory(); f.state.failStartsRemaining = 99;
        const mic = new MicController({ createVad: f.factory, retryDelaysMs: [10, 10] });
        const p = mic.setIntent('listen'); await vi.advanceTimersByTimeAsync(500); await p;
        expect(mic.status).toBe('failed');
        f.state.failStartsRemaining = 0;
        await mic.poke('user-retry');
        expect(mic.status).toBe('listening');
        await mic.dispose();
    });

    it('watchdog restarts a VAD that stopped producing frames (suspended AudioContext / unplugged mic)', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory, watchdogMs: 3_000 });
        await mic.setIntent('listen');
        f.state.lastFrame = Date.now() - 10_000; // frames stopped
        await vi.advanceTimersByTimeAsync(1_500);
        expect(f.state.created).toBe(2);
        expect(mic.status).toBe('listening');
        await mic.dispose();
    });

    it('mute pauses immediately and stays paused until intent changes', async () => {
        const f = fakeVadFactory();
        const mic = new MicController({ createVad: f.factory });
        await mic.setIntent('listen');
        await mic.setIntent('mute');
        expect(mic.status).toBe('muted');
        expect(f.state.listening).toBe(false);
        await mic.poke('visible');
        expect(f.state.listening).toBe(false);
        await mic.dispose();
    });

    it('forwards VAD misfires (speech start that never became speech)', async () => {
        const f = fakeVadFactory(); const onMisfire = vi.fn();
        const mic = new MicController({ createVad: f.factory, onMisfire });
        await mic.setIntent('listen');
        f.cb().onMisfire?.();
        expect(onMisfire).toHaveBeenCalledTimes(1);
        await mic.dispose();
    });

    it('forwards speech end audio even when paused mid-utterance', async () => {
        const f = fakeVadFactory(); const got: number[] = [];
        const mic = new MicController({ createVad: f.factory, onSpeechEnd: a => got.push(a.length) });
        await mic.setIntent('listen');
        f.cb().onSpeechEnd(new Float32Array(16000));
        await mic.setIntent('off');
        f.cb().onSpeechEnd(new Float32Array(8000)); // submitUserSpeechOnPause tail
        expect(got).toEqual([16000, 8000]);
        await mic.dispose();
    });
});
