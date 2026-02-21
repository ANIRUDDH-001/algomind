/**
 * Unit tests for TTSManager.
 *
 * Run:
 *   npx vitest run src/lib/voice/__tests__/tts-manager.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TTSManager,
    TTSEvent,
    getTTSManager,
    resetTTSManager,
} from '../tts-manager';

// ─── Mock SpeechSynthesis ──────────────────────────────────────────

interface MockUtterance {
    text: string;
    voice: SpeechSynthesisVoice | null;
    rate: number;
    pitch: number;
    volume: number;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
}

let mockUtterances: MockUtterance[] = [];
let cancelCalled = false;
let pauseCalled = false;
let resumeCalled = false;
let disableAutoEnd = false;

function createMockSpeechSynthesis() {
    return {
        speak: vi.fn((utterance: MockUtterance) => {
            mockUtterances.push(utterance);
            if (!disableAutoEnd) {
                // Simulate near-immediate completion
                setTimeout(() => utterance.onend?.(), 1);
            }
        }),
        cancel: vi.fn(() => {
            cancelCalled = true;
            // When cancel is called, fire onend for the current utterance
            // synchronously so the _speakChunk promise resolves
            const current = mockUtterances[mockUtterances.length - 1];
            if (current?.onend) {
                current.onend();
                current.onend = null; // prevent double-fire
            }
        }),
        pause: vi.fn(() => { pauseCalled = true; }),
        resume: vi.fn(() => { resumeCalled = true; }),
        getVoices: vi.fn(() => []),
    };
}

class MockSpeechSynthesisUtterance {
    text: string;
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) { this.text = text; }
}

// Constants
const FADE_STEPS = 5;
const FADE_STEP_MS = 10; // 50ms / 5 steps

// ─── Setup / Teardown ──────────────────────────────────────────────

let mockSynth: ReturnType<typeof createMockSpeechSynthesis>;

beforeEach(() => {
    vi.useFakeTimers();
    mockUtterances = [];
    cancelCalled = false;
    pauseCalled = false;
    resumeCalled = false;
    disableAutoEnd = false;

    mockSynth = createMockSpeechSynthesis();

    // Attach mocks to globalThis.window (TTSManager checks typeof window)
    (globalThis as any).window = {
        speechSynthesis: mockSynth,
    };
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    resetTTSManager();
});

afterEach(() => {
    resetTTSManager();
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).SpeechSynthesisUtterance;
});

// ── Helper: cancel with fade ────────────────────────────────────
// cancel() internally awaits _fadeOutVolume (50ms via intervals)
// then calls _browserCancel(). We need to advance timers for the fade.
async function cancelWithFade(tts: TTSManager): Promise<void> {
    const p = tts.cancel();
    // Advance through all fade steps
    for (let i = 0; i < FADE_STEPS; i++) {
        await vi.advanceTimersByTimeAsync(FADE_STEP_MS);
    }
    // Flush any remaining timers (Safari 10ms delay, etc.)
    await vi.advanceTimersByTimeAsync(20);
    await p;
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('TTSManager', () => {
    // ── Construction & singleton ──────────────────────────────────

    test('getTTSManager returns singleton', () => {
        const a = getTTSManager();
        const b = getTTSManager();
        expect(a).toBe(b);
    });

    test('resetTTSManager destroys and clears singleton', () => {
        const a = getTTSManager();
        resetTTSManager();
        const b = getTTSManager();
        expect(a).not.toBe(b);
    });

    // ── Initial state ────────────────────────────────────────────

    test('starts in non-playing state', () => {
        const tts = new TTSManager();
        expect(tts.isPlaying()).toBe(false);
        expect(tts.getQueue()).toEqual([]);
    });

    // ── speak() ──────────────────────────────────────────────────

    test('speak() queues chunks and processes them', async () => {
        const tts = new TTSManager();

        const p = tts.speak('Hello world. This is a test.');
        // 50ms readiness delay + 1ms per chunk onend
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(mockSynth.speak).toHaveBeenCalled();
        expect(tts.isPlaying()).toBe(false);
    });

    test('speak() with empty text is a no-op', async () => {
        const tts = new TTSManager();
        await tts.speak('');
        expect(mockSynth.speak).not.toHaveBeenCalled();
    });

    test('speak() applies voice and rate options', async () => {
        const tts = new TTSManager();
        const mockVoice = { name: 'Test', lang: 'en' } as SpeechSynthesisVoice;

        const p = tts.speak('Hello.', { voice: mockVoice, rate: 1.5, pitch: 0.8 });
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        const u = mockUtterances[0];
        expect(u.voice).toBe(mockVoice);
        expect(u.rate).toBe(1.5);
        expect(u.pitch).toBe(0.8);
    });

    // ── cancel() ─────────────────────────────────────────────────

    test('cancel() clears queue', async () => {
        const tts = new TTSManager();
        disableAutoEnd = true;

        tts.speak('First sentence. Second sentence. Third sentence.');
        await vi.advanceTimersByTimeAsync(55);
        expect(tts.isPlaying()).toBe(true);

        await cancelWithFade(tts);

        expect(tts.getQueue()).toEqual([]);
        expect(tts.isPlaying()).toBe(false);
    });

    test('cancel() calls speechSynthesis.cancel()', async () => {
        const tts = new TTSManager();
        disableAutoEnd = true;

        tts.speak('Hello world.');
        await vi.advanceTimersByTimeAsync(55);

        await cancelWithFade(tts);

        expect(cancelCalled).toBe(true);
    });

    test('cancel() emits INTERRUPT event when playing', async () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.INTERRUPT, listener);

        disableAutoEnd = true;
        tts.speak('Hello world.');
        await vi.advanceTimersByTimeAsync(55);
        expect(tts.isPlaying()).toBe(true);

        await cancelWithFade(tts);

        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('cancel() does not emit INTERRUPT when not playing', async () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.INTERRUPT, listener);

        await tts.cancel();
        expect(listener).not.toHaveBeenCalled();
    });

    // ── Volume fade-out ──────────────────────────────────────────

    test('cancel() fades volume before cancelling', async () => {
        const tts = new TTSManager();
        disableAutoEnd = true;

        tts.speak('Hello world.');
        await vi.advanceTimersByTimeAsync(55);

        const utterance = mockUtterances[0];
        expect(utterance.volume).toBe(1);

        await cancelWithFade(tts);

        // Volume should have been ramped down to 0
        expect(utterance.volume).toBe(0);
    });

    // ── pause() / resume() ───────────────────────────────────────

    test('pause() calls speechSynthesis.pause()', () => {
        const tts = new TTSManager();
        (tts as any)._isPlaying = true;

        tts.pause();
        expect(pauseCalled).toBe(true);
    });

    test('resume() calls speechSynthesis.resume()', () => {
        const tts = new TTSManager();
        (tts as any)._isPlaying = true;
        (tts as any)._isPaused = true;

        tts.resume();
        expect(resumeCalled).toBe(true);
    });

    test('pause() is a no-op when not playing', () => {
        const tts = new TTSManager();
        tts.pause();
        expect(pauseCalled).toBe(false);
    });

    // ── stop() ───────────────────────────────────────────────────

    test('stop() cancels synchronously', () => {
        const tts = new TTSManager();
        (tts as any)._isPlaying = true;

        tts.stop();
        expect(cancelCalled).toBe(true);
        expect(tts.isPlaying()).toBe(false);
    });

    // ── Queue management ─────────────────────────────────────────

    test('getQueue() returns a copy of pending chunks', async () => {
        const tts = new TTSManager();
        disableAutoEnd = true;

        tts.speak('First sentence. Second sentence. Third sentence.');
        await vi.advanceTimersByTimeAsync(55);

        const q = tts.getQueue();
        expect(Array.isArray(q)).toBe(true);
    });

    test('clearQueue() empties pending chunks', async () => {
        const tts = new TTSManager();
        disableAutoEnd = true;

        tts.speak('First sentence. Second sentence. Third sentence.');
        await vi.advanceTimersByTimeAsync(55);

        tts.clearQueue();
        expect(tts.getQueue()).toEqual([]);
    });

    // ── Events ───────────────────────────────────────────────────

    test('emits START event when speaking begins', async () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.START, listener);

        const p = tts.speak('Hello.');
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].event).toBe(TTSEvent.START);
    });

    test('emits END event when all chunks finish', async () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.END, listener);

        const p = tts.speak('Hello.');
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('emits CHUNK_START and CHUNK_END events', async () => {
        const tts = new TTSManager();
        const csListener = vi.fn();
        const ceListener = vi.fn();
        tts.on(TTSEvent.CHUNK_START, csListener);
        tts.on(TTSEvent.CHUNK_END, ceListener);

        const p = tts.speak('Hello world.');
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(csListener).toHaveBeenCalled();
        expect(ceListener).toHaveBeenCalled();
    });

    test('on() returns unsubscribe function', () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        const unsub = tts.on(TTSEvent.INTERRUPT, listener);

        (tts as any)._isPlaying = true;
        tts.stop();
        expect(listener).toHaveBeenCalledTimes(1);

        unsub();
        (tts as any)._isPlaying = true;
        tts.stop();
        expect(listener).toHaveBeenCalledTimes(1); // no extra call
    });

    test('removeAllListeners clears all event handlers', () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.INTERRUPT, listener);

        tts.removeAllListeners();
        (tts as any)._isPlaying = true;
        tts.stop();
        expect(listener).not.toHaveBeenCalled();
    });

    // ── Browser-specific (Safari via _browserOverride) ───────────

    test('Safari: uses pause → cancel strategy', async () => {
        const tts = new TTSManager({ _browserOverride: 'safari' });
        disableAutoEnd = true;

        tts.speak('Hello.');
        (tts as any)._isPlaying = true;

        await cancelWithFade(tts);

        expect(pauseCalled).toBe(true);
        expect(cancelCalled).toBe(true);
    });

    // ── destroy() ────────────────────────────────────────────────

    test('destroy() cancels speech and clears listeners', () => {
        const tts = new TTSManager();
        const listener = vi.fn();
        tts.on(TTSEvent.START, listener);

        tts.destroy();

        (tts as any)._emit(TTSEvent.START);
        expect(listener).not.toHaveBeenCalled();
    });

    // ── setOptions ───────────────────────────────────────────────

    test('setOptions merges with existing options', () => {
        const tts = new TTSManager({ rate: 1.0 });
        tts.setOptions({ rate: 1.5, pitch: 0.8 });
        expect((tts as any)._options.rate).toBe(1.5);
        expect((tts as any)._options.pitch).toBe(0.8);
    });

    // ── Error handling ───────────────────────────────────────────

    test('utterance error resolves without throwing', async () => {
        const tts = new TTSManager();

        mockSynth.speak.mockImplementation((utterance: MockUtterance) => {
            mockUtterances.push(utterance);
            setTimeout(() => utterance.onerror?.({ error: 'network' }), 1);
        });

        const p = tts.speak('Hello.');
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(tts.isPlaying()).toBe(false);
    });

    test('interrupted/canceled errors are silently ignored', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const tts = new TTSManager();

        mockSynth.speak.mockImplementation((utterance: MockUtterance) => {
            mockUtterances.push(utterance);
            setTimeout(() => utterance.onerror?.({ error: 'interrupted' }), 1);
        });

        const p = tts.speak('Hello.');
        await vi.advanceTimersByTimeAsync(60);
        await vi.runAllTimersAsync();
        await p;

        expect(spy).not.toHaveBeenCalled();
    });

    // ── Requested Coverage Scenarios ─────────────────────────────────────────────

    describe('Requested Coverage', () => {
        test('1. speak(text) calls speechSynthesis.speak with correct utterance', async () => {
            const tts = new TTSManager();
            const p = tts.speak('One sentence.');
            await vi.advanceTimersByTimeAsync(60);
            await vi.runAllTimersAsync();
            await p;
            expect(mockSynth.speak).toHaveBeenCalled();
            expect(mockUtterances[0].text).toBe('One sentence.');
        });

        test('2. cancel() calls speechSynthesis.cancel and clears queue', async () => {
            const tts = new TTSManager();
            disableAutoEnd = true;
            tts.enqueueChunk('Chunk one.');
            tts.enqueueChunk('Chunk two.');
            await vi.advanceTimersByTimeAsync(60);
            expect(tts.getQueue().length).toBe(1);
            await cancelWithFade(tts);
            expect(cancelCalled).toBe(true);
            expect(tts.getQueue()).toEqual([]);
        });

        test('3. Queue behavior: if already speaking, new enqueueChunk() is queued not dropped', async () => {
            const tts = new TTSManager();
            disableAutoEnd = true;
            tts.enqueueChunk('First.');
            await vi.advanceTimersByTimeAsync(60);
            tts.enqueueChunk('Second.');
            expect(tts.getQueue()).toEqual(['Second.']);
        });

        test('4. Queue drains: after onend fires, next item in queue starts', async () => {
            const tts = new TTSManager();
            disableAutoEnd = true;
            tts.enqueueChunk('First.');
            tts.enqueueChunk('Second.');
            await vi.advanceTimersByTimeAsync(60);
            expect(mockUtterances.length).toBe(1);
            expect(mockUtterances[0].text).toBe('First.');

            // manually trigger onend for the first chunk
            mockUtterances[0].onend?.();
            await vi.advanceTimersByTimeAsync(1);
            await vi.runAllTimersAsync();

            expect(mockUtterances.length).toBe(2);
            expect(mockUtterances[1].text).toBe('Second.');
        });

        test('5. onSentenceComplete callback: fires at correct sentence boundaries (via CHUNK_END)', async () => {
            const tts = new TTSManager();
            const listener = vi.fn();
            tts.on(TTSEvent.CHUNK_END, listener);

            disableAutoEnd = true;
            tts.enqueueChunk('Sentence one.');
            tts.enqueueChunk('Sentence two.');

            await vi.advanceTimersByTimeAsync(60);
            mockUtterances[0].onend?.();
            await vi.advanceTimersByTimeAsync(1);
            await vi.runAllTimersAsync();

            mockUtterances[1].onend?.();
            await vi.advanceTimersByTimeAsync(1);
            await vi.runAllTimersAsync();

            expect(listener).toHaveBeenCalledTimes(2);
            expect(listener.mock.calls[0][0].text).toBe('Sentence one.');
            expect(listener.mock.calls[1][0].text).toBe('Sentence two.');
        });

        test('6. Error handling: speechSynthesis.onerror -> queue continues', async () => {
            const tts = new TTSManager();
            disableAutoEnd = true;
            tts.enqueueChunk('Error chunk.');
            tts.enqueueChunk('Next chunk.');
            await vi.advanceTimersByTimeAsync(60);

            // Trigger standard browser error for the first chunk
            mockUtterances[0].onerror?.({ error: 'network' } as any);
            await vi.advanceTimersByTimeAsync(10);
            await vi.runAllTimersAsync();

            expect(mockUtterances.length).toBe(2);
            expect(mockUtterances[1].text).toBe('Next chunk.');
        });

        test('7. isSpeaking getter: true while utterance is active, false otherwise', async () => {
            const tts = new TTSManager();
            expect(tts.isPlaying()).toBe(false);
            disableAutoEnd = true;
            tts.speak('Test.');
            await vi.advanceTimersByTimeAsync(60);
            expect(tts.isPlaying()).toBe(true);
            mockUtterances[0].onend?.();
            await vi.advanceTimersByTimeAsync(10);
            expect(tts.isPlaying()).toBe(false);
        });

        test('8. Voice selection: prefers a matching voice by lang / from options', async () => {
            const tts = new TTSManager();
            const customVoice = { lang: 'en-US', name: 'Custom Voice' } as SpeechSynthesisVoice;
            const p = tts.speak('Hello.', { voice: customVoice });
            await vi.advanceTimersByTimeAsync(60);
            await vi.runAllTimersAsync();
            await p;
            expect(mockUtterances[0].voice).toBe(customVoice);
        });

        test('9. Rate/pitch/volume: applied correctly from VoiceSettings config', async () => {
            const tts = new TTSManager();
            const p = tts.speak('Hello.', { rate: 1.2, pitch: 1.1, volume: 0.9 });
            await vi.advanceTimersByTimeAsync(60);
            await vi.runAllTimersAsync();
            await p;
            expect(mockUtterances[0].rate).toBe(1.2);
            expect(mockUtterances[0].pitch).toBe(1.1);
            expect(mockUtterances[0].volume).toBe(0.9);
        });
    });
});
