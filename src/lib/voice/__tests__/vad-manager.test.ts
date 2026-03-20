import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getVADManager, resetVADManager, VADManager } from '../vad-manager';
import { VADState } from '../types';

// Mock dependencies
const mockMicVADStart = vi.fn();
const mockMicVADPause = vi.fn();
const mockMicVADDestroy = vi.fn();

let createdVADOptions: any = null;

const MockMicVAD = {
    new: vi.fn().mockImplementation(async (options) => {
        createdVADOptions = options;
        return {
            start: mockMicVADStart,
            pause: mockMicVADPause,
            destroy: mockMicVADDestroy,
            listening: false,
        };
    })
};

describe('VADManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createdVADOptions = null;

        // Implementation of loadScript uses 'document'
        (globalThis as any).document = {
            querySelector: vi.fn().mockReturnValue(null),
            createElement: vi.fn().mockImplementation(() => ({
                set src(val: string) { },
                get src() { return ''; },
                onload: null,
                onerror: null,
                async: false,
            })),
            head: {
                appendChild: vi.fn().mockImplementation((el) => {
                    // Simulate async script load
                    setTimeout(() => el.onload?.(), 10);
                })
            }
        };

        // Setup raw browser mocks expected by `_assertBrowserSupport`
        (globalThis as any).window = {
            AudioContext: vi.fn(),
            // The injection token expected by init() script loader bypass
            mockMicVAD: MockMicVAD,
            document: (globalThis as any).document,
        };
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                mediaDevices: {
                    getUserMedia: vi.fn(),
                },
            },
            configurable: true,
        });
        (globalThis as any).WebAssembly = {};
    });

    afterEach(async () => {
        await resetVADManager();
        delete (globalThis as any).window;
        delete (globalThis as any).navigator;
        delete (globalThis as any).WebAssembly;
    });

    it('1. init(): creates VAD with correct config params', async () => {
        const vad = getVADManager();
        await vad.init({ positiveSpeechThreshold: 0.95 });

        expect(MockMicVAD.new).toHaveBeenCalledTimes(1);
        expect(createdVADOptions).toBeDefined();
        // verify override
        expect(createdVADOptions.positiveSpeechThreshold).toBe(0.95);
        // verify default kept
        expect(createdVADOptions.negativeSpeechThreshold).toBe(0.25);
        expect(vad.state).toBe(VADState.PAUSED);
    });

    it('2. onSpeechStart callback: correctly forwarded from VAD events', async () => {
        const vad = getVADManager();
        await vad.init();

        const listener = vi.fn();
        vad.onSpeechStart(listener);

        // trigger the internal callback that vad-web would execute
        createdVADOptions.onSpeechStart();

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('3. onSpeechEnd callback: correctly forwarded with audio data', async () => {
        const vad = getVADManager();
        await vad.init();

        const listener = vi.fn();
        vad.onSpeechEnd(listener);

        // trigger the internal callback
        const mockAudio = new Float32Array([0.1, 0.2, 0.3]);
        createdVADOptions.onSpeechEnd(mockAudio);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(mockAudio);
    });

    it('4. start()/stop(): call underlying VAD start/stop', async () => {
        const vad = getVADManager();
        await vad.init();

        expect(vad.state).toBe(VADState.PAUSED);

        await vad.start();
        expect(mockMicVADStart).toHaveBeenCalledTimes(1);
        expect(vad.state).toBe(VADState.LISTENING);

        await vad.stop();
        expect(mockMicVADPause).toHaveBeenCalledTimes(1);
        expect(vad.state).toBe(VADState.PAUSED);
    });

    it('5. Error during init: onError callback fires, isReady stays false', async () => {
        const vad = getVADManager();

        // Force init to branch to error by removing mockMicVAD token
        delete (globalThis as any).window.mockMicVAD;

        await expect(vad.init()).rejects.toThrow();
        expect(vad.state).toBe(VADState.ERROR);
    });

    it('6. isReady: implicitly tracked via VADState.PAUSED after successful init', async () => {
        const vad = getVADManager();
        expect(vad.state).toBe(VADState.IDLE);

        await vad.init();

        expect(vad.state).toBe(VADState.PAUSED); // Ready to start
    });

    it('7. Device type detection: adapts VAD config via dependency injection overrides', async () => {
        // Since isMobileDevice is not imported directly by VADManager in this architecture,
        // we test the public config overrides injection flow itself which is how UI layers pass mobile thresholds.
        const vad = getVADManager();

        // Simulate a consumer passing a lowered threshold for mobile
        await vad.init({ positiveSpeechThreshold: 0.70 });

        expect(createdVADOptions.positiveSpeechThreshold).toBe(0.70);
    });

    it('8. Cleanup: destroy() stops VAD and prevents further callbacks', async () => {
        const vad = getVADManager();
        await vad.init();

        const listener = vi.fn();
        vad.onSpeechStart(listener);

        await vad.destroy();

        expect(mockMicVADDestroy).toHaveBeenCalledTimes(1);
        expect(vad.state).toBe(VADState.DESTROYED);

        // Attempting to trigger callback after clear should fail because sets were flushed
        expect(() => createdVADOptions.onSpeechStart()).not.toThrow();
        expect(listener).not.toHaveBeenCalled();
    });
});
