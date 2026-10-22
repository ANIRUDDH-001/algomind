/**
 * @codesage
 * @file      src/hooks/__tests__/useVAD.test.ts
 * @purpose   useVAD over MicController: readiness, stable callbacks, fallback-once, devicechange recovery.
 * @tech      Vitest, React Testing Library (fake timers)
 * @connects  ../useVAD, @/lib/voice/mic-controller (real controller, fake VAD factory)
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fake = vi.hoisted(() => ({ failStarts: 0, created: 0, cb: null as null | { onSpeechEnd(a: Float32Array): void } }));

vi.mock('@/lib/voice/mic-controller', async (importOriginal) => {
    const real = await importOriginal<typeof import('@/lib/voice/mic-controller')>();
    const createBrowserVad: typeof real.createBrowserVad = async (cb) => {
        fake.created++; fake.cb = cb;
        let last = 0;
        return {
            start: async () => { if (fake.failStarts > 0) { fake.failStarts--; throw new Error('NotReadableError'); } last = Date.now(); },
            pause: async () => {},
            destroy: async () => {},
            lastFrameAt: () => last,
        };
    };
    return { ...real, createBrowserVad };
});

import { useVAD } from '../useVAD';

describe('useVAD (MicController)', () => {
    let devices: EventTarget & { getUserMedia: () => void };
    beforeEach(() => {
        vi.useFakeTimers();
        fake.failStarts = 0; fake.created = 0; fake.cb = null;
        devices = Object.assign(new EventTarget(), { getUserMedia: vi.fn() });
        Object.defineProperty(navigator, 'mediaDevices', { value: devices, configurable: true });
        vi.stubGlobal('AudioContext', vi.fn());
    });
    afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

    it('is ready (not "Initializing…") when VAD is disabled, e.g. browser STT', () => {
        const { result } = renderHook(() => useVAD({ enabled: false }));
        expect(result.current.isReady).toBe(true);
        expect(result.current.status).toBe('off');
    });

    it('starts listening, keeps callback identities stable across status changes, forwards speech', async () => {
        const onSpeechEnd = vi.fn();
        const { result } = renderHook(() => useVAD({ enabled: true, onSpeechEnd }));
        const { startListening, stopListening, poke } = result.current;
        await act(async () => { await result.current.startListening(); });
        expect(result.current.status).toBe('listening');
        expect(result.current.isListening).toBe(true);
        expect(result.current.mode).toBe('onnx');
        expect(result.current.isReady).toBe(true);
        expect(result.current.startListening).toBe(startListening);
        expect(result.current.stopListening).toBe(stopListening);
        expect(result.current.poke).toBe(poke);
        fake.cb!.onSpeechEnd(new Float32Array(10));
        expect(onSpeechEnd).toHaveBeenCalledTimes(1);
        await act(async () => { await result.current.stopListening(); });
        expect(result.current.isListening).toBe(false);
    });

    it('falls back to push-to-talk once after retries are exhausted', async () => {
        fake.failStarts = 99;
        const onFallback = vi.fn(); const onError = vi.fn();
        const { result } = renderHook(() => useVAD({ enabled: true, onFallback, onError }));
        await act(async () => { const p = result.current.startListening(); await vi.advanceTimersByTimeAsync(10_000); await p; });
        expect(result.current.status).toBe('failed');
        expect(result.current.mode).toBe('push-to-talk');
        expect(onFallback).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledTimes(1);
        await act(async () => { const p = result.current.startListening(); await vi.advanceTimersByTimeAsync(10_000); await p; });
        expect(onFallback).toHaveBeenCalledTimes(1);
    });

    it('reports every mic status change to the parent (telemetry)', async () => {
        fake.failStarts = 1;
        const onStatus = vi.fn();
        const { result } = renderHook(() => useVAD({ enabled: true, onStatus }));
        await act(async () => { const p = result.current.startListening(); await vi.advanceTimersByTimeAsync(2_000); await p; });
        expect(onStatus.mock.calls.map(c => c[0])).toEqual(['starting', 'recovering', 'listening']);
        expect(onStatus.mock.calls[1][1]).toBeUndefined();
    });

    it('a plugged-in mic (devicechange) recovers a failed VAD', async () => {
        fake.failStarts = 99;
        const { result } = renderHook(() => useVAD({ enabled: true }));
        await act(async () => { const p = result.current.startListening(); await vi.advanceTimersByTimeAsync(10_000); await p; });
        expect(result.current.status).toBe('failed');
        fake.failStarts = 0;
        await act(async () => { devices.dispatchEvent(new Event('devicechange')); await vi.advanceTimersByTimeAsync(10); });
        expect(result.current.status).toBe('listening');
    });
});
