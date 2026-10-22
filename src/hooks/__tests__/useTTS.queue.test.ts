/**
 * @codesage
 * @file      src/hooks/__tests__/useTTS.queue.test.ts
 * @purpose   useTTS is a thin React wrapper over the SpeechQueue singleton.
 * @tech      Vitest, React Testing Library
 * @connects  ../useTTS, @/lib/voice/speech-queue (mocked)
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SpeechQueueEvent } from '@/lib/voice/speech-queue';

type Listener = (e: SpeechQueueEvent) => void;
const fakeQueue = {
    listeners: new Set<Listener>(),
    enqueued: [] as string[],
    idleResolvers: [] as Array<() => void>,
    configure: vi.fn(),
    enqueue: vi.fn((t: string) => { fakeQueue.enqueued.push(t); }),
    stop: vi.fn(),
    unlock: vi.fn(),
    whenIdle: vi.fn(() => new Promise<void>(r => fakeQueue.idleResolvers.push(r))),
    on(fn: Listener) { fakeQueue.listeners.add(fn); return () => fakeQueue.listeners.delete(fn); },
    emit(e: SpeechQueueEvent) { fakeQueue.listeners.forEach(fn => fn(e)); },
    speaking: false,
};
vi.mock('@/lib/voice/speech-queue', () => ({ getSpeechQueue: () => fakeQueue }));

import { useTTS } from '../useTTS';

describe('useTTS over SpeechQueue', () => {
    beforeEach(() => {
        fakeQueue.listeners.clear(); fakeQueue.enqueued = []; fakeQueue.idleResolvers = [];
        vi.clearAllMocks();
        vi.stubGlobal('speechSynthesis', {}); // real browsers expose it; jsdom does not
    });

    it('configures the queue with the user voice preferences', () => {
        renderHook(() => useTTS({ voiceName: 'Google UK English Female', voiceRate: 1.2, voicePitch: 0.9 }));
        expect(fakeQueue.configure).toHaveBeenCalledWith({ preferredVoiceName: 'Google UK English Female', rate: 1.2, pitch: 0.9 });
    });

    it('enqueue passes sentences straight to the queue', () => {
        const { result } = renderHook(() => useTTS());
        act(() => { result.current.enqueue('Hello there.'); });
        expect(fakeQueue.enqueued).toEqual(['Hello there.']);
    });

    it('isSpeaking mirrors queue speaking events and calls onSpeakStart/End', () => {
        const onSpeakStart = vi.fn(); const onSpeakEnd = vi.fn();
        const { result } = renderHook(() => useTTS({ onSpeakStart, onSpeakEnd }));
        act(() => fakeQueue.emit({ type: 'speaking', value: true }));
        expect(result.current.isSpeaking).toBe(true);
        expect(onSpeakStart).toHaveBeenCalled();
        act(() => fakeQueue.emit({ type: 'speaking', value: false }));
        expect(result.current.isSpeaking).toBe(false);
        expect(onSpeakEnd).toHaveBeenCalled();
    });

    it('speakAndWait resolves true once the queue is idle', async () => {
        const { result } = renderHook(() => useTTS());
        let done: boolean | undefined;
        act(() => { void result.current.speakAndWait('Hi candidate.').then(v => { done = v; }); });
        expect(done).toBeUndefined();
        await act(async () => { fakeQueue.idleResolvers.forEach(r => r()); });
        expect(done).toBe(true);
    });

    it('blocked event sets blocked; unlock clears it', () => {
        const { result } = renderHook(() => useTTS());
        act(() => fakeQueue.emit({ type: 'blocked' }));
        expect(result.current.blocked).toBe(true);
        act(() => result.current.unlock());
        expect(fakeQueue.unlock).toHaveBeenCalled();
        expect(result.current.blocked).toBe(false);
    });

    it('forwards first-audio and error events to onEvent', () => {
        const onEvent = vi.fn();
        renderHook(() => useTTS({ onEvent }));
        act(() => fakeQueue.emit({ type: 'first-audio', latencyMs: 120, voice: 'Google US English' }));
        act(() => fakeQueue.emit({ type: 'error', code: 'watchdog' }));
        expect(onEvent).toHaveBeenCalledWith({ type: 'first-audio', latencyMs: 120, voice: 'Google US English' });
        expect(onEvent).toHaveBeenCalledWith({ type: 'error', code: 'watchdog' });
    });

    it('forwards blocked (autoplay policy) to onEvent too, so the turn records why Kai was silent', () => {
        const onEvent = vi.fn();
        const { result } = renderHook(() => useTTS({ onEvent }));
        act(() => fakeQueue.emit({ type: 'blocked' }));
        expect(onEvent).toHaveBeenCalledWith({ type: 'blocked' });
        expect(result.current.blocked).toBe(true);
    });
});
