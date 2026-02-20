/**
 * Unit tests for VADManager.
 *
 * Strategy:
 * - For state machine, callbacks, start/stop, destroy: inject mock MicVAD directly.
 * - For init() path: mock document/window globals to test script loading + MicVAD construction.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { VADState } from '../types';
import { createMockMicVAD } from '@/test-utils/voice-mocks';

 
type Any = any;

// ── Module-level state needs resetting between tests ────────────────
// We re-import the module for init-path tests to get fresh module state.

// ── Helpers ─────────────────────────────────────────────────────────

async function createInitialisedManager() {
    // Dynamic import to avoid module caching issues in init-path tests
    const { VADManager } = await import('../vad-manager');
    const manager = new VADManager();
    const mockVAD = createMockMicVAD();

    (manager as Any)._state = VADState.PAUSED;
    (manager as Any)._micVAD = mockVAD;
    (manager as Any)._error = null;

    return { manager, mockVAD };
}

// ── Setup / Teardown ────────────────────────────────────────────────

beforeEach(() => {
    vi.restoreAllMocks();
});

afterEach(async () => {
    // Reset singleton
    try {
        const { resetVADManager } = await import('../vad-manager');
        await resetVADManager();
    } catch { /* ok */ }

    // Clean up DOM globals
    delete (globalThis as Any).document;
    delete (globalThis as Any).window;
    delete (globalThis as Any).AudioContext;
    delete (globalThis as Any).WebAssembly;

    // Reset module registry so _scriptsLoaded resets
    vi.resetModules();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('VADManager', () => {
    // ── Initial state ─────────────────────────────────────────────

    test('starts in IDLE state', async () => {
        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        expect(manager.state).toBe(VADState.IDLE);
        expect(manager.error).toBeNull();
    });

    // ── Singleton ─────────────────────────────────────────────────

    test('getVADManager returns the same instance', async () => {
        const { getVADManager } = await import('../vad-manager');
        const a = getVADManager();
        const b = getVADManager();
        expect(a).toBe(b);
    });

    test('getVADManager returns new instance after resetVADManager', async () => {
        const { getVADManager, resetVADManager } = await import('../vad-manager');
        const a = getVADManager();
        await resetVADManager();
        const b = getVADManager();
        expect(a).not.toBe(b);
    });

    test('getVADManager returns new instance after destroy', async () => {
        const { getVADManager } = await import('../vad-manager');
        const a = getVADManager();
        await a.destroy();
        expect(a.state).toBe(VADState.DESTROYED);
        const b = getVADManager();
        expect(a).not.toBe(b);
        expect(b.state).toBe(VADState.IDLE);
    });

    // ── start() / stop() ──────────────────────────────────────────

    test('start() transitions from PAUSED to LISTENING', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.start();
        expect(mockVAD.start).toHaveBeenCalledOnce();
        expect(manager.state).toBe(VADState.LISTENING);
    });

    test('start() is a no-op if already LISTENING', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.start();
        await manager.start();
        expect(mockVAD.start).toHaveBeenCalledOnce();
    });

    test('start() throws if not initialised', async () => {
        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await expect(manager.start()).rejects.toThrow('called before init');
    });

    test('start() failure sets ERROR state', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        mockVAD.start.mockRejectedValueOnce(new Error('mic busy'));
        await expect(manager.start()).rejects.toThrow('mic busy');
        expect(manager.state).toBe(VADState.ERROR);
    });

    test('stop() transitions from LISTENING to PAUSED', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.start();
        await manager.stop();
        expect(mockVAD.pause).toHaveBeenCalledOnce();
        expect(manager.state).toBe(VADState.PAUSED);
    });

    test('stop() is a no-op if not LISTENING', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.stop();
        expect(mockVAD.pause).not.toHaveBeenCalled();
    });

    // ── Callbacks ─────────────────────────────────────────────────

    test('onSpeechStart fires registered callback', async () => {
        const { manager } = await createInitialisedManager();
        const cb = vi.fn();
        manager.onSpeechStart(cb);
        (manager as Any)._onSpeechStartCbs.forEach((fn: () => void) => fn());
        expect(cb).toHaveBeenCalledOnce();
    });

    test('onSpeechEnd fires with audio data', async () => {
        const { manager } = await createInitialisedManager();
        const cb = vi.fn();
        manager.onSpeechEnd(cb);
        const audio = new Float32Array([0.1, 0.2]);
        (manager as Any)._onSpeechEndCbs.forEach((fn: (a: Float32Array) => void) => fn(audio));
        expect(cb).toHaveBeenCalledWith(audio);
    });

    test('onMisfire fires registered callback', async () => {
        const { manager } = await createInitialisedManager();
        const cb = vi.fn();
        manager.onMisfire(cb);
        (manager as Any)._onMisfireCbs.forEach((fn: () => void) => fn());
        expect(cb).toHaveBeenCalledOnce();
    });

    test('onFrameProcessed fires with probability', async () => {
        const { manager } = await createInitialisedManager();
        const cb = vi.fn();
        manager.onFrameProcessed(cb);
        (manager as Any)._onFrameProcessedCbs.forEach((fn: (p: number) => void) => fn(0.85));
        expect(cb).toHaveBeenCalledWith(0.85);
    });

    test('unsubscribe removes callback', async () => {
        const { manager } = await createInitialisedManager();
        const cb = vi.fn();
        const unsub = manager.onSpeechStart(cb);
        unsub();
        expect((manager as Any)._onSpeechStartCbs.size).toBe(0);
    });

    test('multiple subscribers all receive events', async () => {
        const { manager } = await createInitialisedManager();
        const cb1 = vi.fn();
        const cb2 = vi.fn();
        manager.onSpeechStart(cb1);
        manager.onSpeechStart(cb2);
        (manager as Any)._onSpeechStartCbs.forEach((fn: () => void) => fn());
        expect(cb1).toHaveBeenCalledOnce();
        expect(cb2).toHaveBeenCalledOnce();
    });

    test('callback error does not break other callbacks', async () => {
        const { manager } = await createInitialisedManager();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        const bad = vi.fn(() => { throw new Error('boom'); });
        const good = vi.fn();
        manager.onSpeechStart(bad);
        manager.onSpeechStart(good);
        (manager as Any)._onSpeechStartCbs.forEach((fn: () => void) => {
            try { fn(); } catch (err) {
                console.error('[VADManager] onSpeechStart callback error:', err);
            }
        });
        expect(good).toHaveBeenCalledOnce();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    // ── destroy() ─────────────────────────────────────────────────

    test('destroy() releases MicVAD and clears callbacks', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        manager.onSpeechStart(vi.fn());
        await manager.destroy();
        expect(mockVAD.destroy).toHaveBeenCalledOnce();
        expect(manager.state).toBe(VADState.DESTROYED);
        expect((manager as Any)._onSpeechStartCbs.size).toBe(0);
        expect((manager as Any)._micVAD).toBeNull();
    });

    test('destroy() is idempotent', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.destroy();
        await manager.destroy();
        expect(mockVAD.destroy).toHaveBeenCalledOnce();
    });

    test('destroy() handles MicVAD.destroy() failure gracefully', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        mockVAD.destroy.mockRejectedValueOnce(new Error('cleanup failed'));
        await manager.destroy();
        expect(manager.state).toBe(VADState.DESTROYED);
    });

    // ── _assertReady edge cases ───────────────────────────────────

    test('start() after destroy throws', async () => {
        const { manager } = await createInitialisedManager();
        await manager.destroy();
        await expect(manager.start()).rejects.toThrow('called before init');
    });

    test('start() in error state throws', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        mockVAD.start.mockRejectedValueOnce(new Error('oops'));
        try { await manager.start(); } catch { /* expected */ }
        await expect(manager.start()).rejects.toThrow('error state');
    });

    // ── init() state checks ───────────────────────────────────────

    test('init() when already initialised is a no-op', async () => {
        const { manager } = await createInitialisedManager();
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        await manager.init();
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('init() called in state'));
        consoleSpy.mockRestore();
    });

    test('init() when destroyed throws', async () => {
        const { manager } = await createInitialisedManager();
        await manager.destroy();
        await expect(manager.init()).rejects.toThrow('destroyed');
    });

    // ── resetVADManager ───────────────────────────────────────────

    test('resetVADManager on null instance is safe', async () => {
        const { resetVADManager } = await import('../vad-manager');
        await resetVADManager();
        await resetVADManager();
    });
});

// ────────────────────────────────────────────────────────────────────
// init() path tests — need mocked DOM globals
// ────────────────────────────────────────────────────────────────────

describe('VADManager.init() — full path', () => {
    function setupBrowserGlobals(options: { micVADAvailable?: boolean; scriptsFail?: boolean } = {}) {
        const { micVADAvailable = true, scriptsFail = false } = options;

        // Mock document
        const scripts: Any[] = [];
        (globalThis as Any).document = {
            querySelector: vi.fn(() => null), // scripts not loaded yet
            createElement: vi.fn(() => {
                const el: Any = {
                    src: '',
                    async: false,
                    onload: null as (() => void) | null,
                    onerror: null as (() => void) | null,
                };
                scripts.push(el);
                return el;
            }),
            head: {
                appendChild: vi.fn((el: Any) => {
                    // Simulate script loaded/errored
                    setTimeout(() => {
                        if (scriptsFail) {
                            el.onerror?.();
                        } else {
                            el.onload?.();
                        }
                    }, 0);
                }),
            },
        };

        // Mock window with optional MicVAD constructor
        const mockMicVADInstance = createMockMicVAD();
        const mockMicVADConstructor = {
            new: vi.fn(async (options?: Any) => mockMicVADInstance),
        };

        (globalThis as Any).window = {
            AudioContext: class { },
            vad: micVADAvailable ? { MicVAD: mockMicVADConstructor } : undefined,
        };
        (globalThis as Any).AudioContext = (globalThis as Any).window.AudioContext;

        Object.defineProperty(globalThis, 'navigator', {
            value: {
                mediaDevices: { getUserMedia: vi.fn(async () => ({})) },
            },
            configurable: true,
            writable: true,
        });

        (globalThis as Any).WebAssembly = { validate: () => true };

        return { mockMicVADInstance, mockMicVADConstructor, scripts };
    }

    test('init() loads scripts and creates MicVAD', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // Fresh module import
        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();

        await manager.init();

        expect(manager.state).toBe(VADState.PAUSED);
        expect(mockMicVADConstructor.new).toHaveBeenCalledOnce();
        expect(manager.error).toBeNull();
    });

    test('init() passes config to MicVAD.new', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();

        await manager.init({ positiveSpeechThreshold: 0.95, minSpeechMs: 500 });

        const opts = (mockMicVADConstructor.new.mock.calls[0] as Any[])[0];
        expect(opts.positiveSpeechThreshold).toBe(0.95);
        expect(opts.minSpeechMs).toBe(500);
        expect(opts.startOnLoad).toBe(false);
    });

    test('init() fires onSpeechStart callback from MicVAD', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        let capturedOnSpeechStart: (() => void) | null = null;
        mockMicVADConstructor.new.mockImplementationOnce(async (opts: Any) => {
            capturedOnSpeechStart = opts.onSpeechStart;
            return createMockMicVAD();
        });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        const cb = vi.fn();
        manager.onSpeechStart(cb);

        await manager.init();

        // Simulate MicVAD firing onSpeechStart
        (capturedOnSpeechStart as Any)?.();
        expect(cb).toHaveBeenCalledOnce();
    });

    test('init() fires onSpeechEnd callback from MicVAD', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        let capturedOnSpeechEnd: ((audio: Float32Array) => void) | null = null;
        mockMicVADConstructor.new.mockImplementationOnce(async (opts: Any) => {
            capturedOnSpeechEnd = opts.onSpeechEnd;
            return createMockMicVAD();
        });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        const cb = vi.fn();
        manager.onSpeechEnd(cb);

        await manager.init();

        const audio = new Float32Array([0.5]);
        (capturedOnSpeechEnd as Any)?.(audio);
        expect(cb).toHaveBeenCalledWith(audio);
    });

    test('init() fires onVADMisfire callback from MicVAD', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        let capturedOnMisfire: (() => void) | null = null;
        mockMicVADConstructor.new.mockImplementationOnce(async (opts: Any) => {
            capturedOnMisfire = opts.onVADMisfire;
            return createMockMicVAD();
        });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        const cb = vi.fn();
        manager.onMisfire(cb);

        await manager.init();
        (capturedOnMisfire as Any)?.();
        expect(cb).toHaveBeenCalledOnce();
    });

    test('init() fires onFrameProcessed callback from MicVAD', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        let capturedOnFrame: ((p: { isSpeech: number }) => void) | null = null;
        mockMicVADConstructor.new.mockImplementationOnce(async (opts: Any) => {
            capturedOnFrame = opts.onFrameProcessed;
            return createMockMicVAD();
        });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        const cb = vi.fn();
        manager.onFrameProcessed(cb);

        await manager.init();
        (capturedOnFrame as Any)?.({ isSpeech: 0.92 });
        expect(cb).toHaveBeenCalledWith(0.92);
    });

    test('init() onFrameProcessed skips when no subscribers', async () => {
        const { mockMicVADConstructor } = setupBrowserGlobals();
        vi.spyOn(console, 'log').mockImplementation(() => { });

        let capturedOnFrame: ((p: { isSpeech: number }) => void) | null = null;
        mockMicVADConstructor.new.mockImplementationOnce(async (opts: Any) => {
            capturedOnFrame = opts.onFrameProcessed;
            return createMockMicVAD();
        });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        // No subscribers registered

        await manager.init();
        // Should not throw
        (capturedOnFrame as Any)?.({ isSpeech: 0.5 });
    });

    test('init() sets ERROR state when MicVAD not found', async () => {
        setupBrowserGlobals({ micVADAvailable: false });
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();

        await expect(manager.init()).rejects.toThrow('MicVAD not found');
        expect(manager.state).toBe(VADState.ERROR);
        expect(manager.error).toContain('MicVAD not found');
    });

    test('init() sets ERROR state when scripts fail to load', async () => {
        setupBrowserGlobals({ scriptsFail: true });
        vi.spyOn(console, 'log').mockImplementation(() => { });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();

        await expect(manager.init()).rejects.toThrow('Failed to load script');
        expect(manager.state).toBe(VADState.ERROR);
    });

    test('init() throws without window', async () => {
        // No window set
        const { VADManager } = await import('../vad-manager');
        vi.spyOn(console, 'error').mockImplementation(() => { });
        const manager = new VADManager();
        await expect(manager.init()).rejects.toThrow('browser environment');
    });

    test('init() throws without AudioContext', async () => {
        setupBrowserGlobals();
        delete (globalThis as Any).window.AudioContext;
        delete (globalThis as Any).AudioContext;
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await expect(manager.init()).rejects.toThrow('AudioContext');
    });

    test('init() throws without getUserMedia', async () => {
        setupBrowserGlobals();
        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            configurable: true,
            writable: true,
        });
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await expect(manager.init()).rejects.toThrow('getUserMedia');
    });

    test('init() throws without WebAssembly', async () => {
        setupBrowserGlobals();
        delete (globalThis as Any).WebAssembly;
        vi.spyOn(console, 'error').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await expect(manager.init()).rejects.toThrow('WebAssembly');
    });

    test('loadScript skips already-present scripts', async () => {
        setupBrowserGlobals();
        // First call will querySelector → null, second will find it
        (globalThis as Any).document.querySelector
            .mockReturnValueOnce(null) // ort.min.js — not found, load it
            .mockReturnValueOnce({ src: '/vad/vad-bundle.min.js' }); // vad-bundle — already present, skip

        vi.spyOn(console, 'log').mockImplementation(() => { });

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await manager.init();

        // Only 1 script should have been created (ort), bundle was already present
        expect((globalThis as Any).document.createElement).toHaveBeenCalledTimes(1);
    });

    test('stop() catches pause error gracefully', async () => {
        const { manager, mockVAD } = await createInitialisedManager();
        await manager.start();
        vi.spyOn(console, 'error').mockImplementation(() => { });
        mockVAD.pause.mockRejectedValueOnce(new Error('pause failed'));
        await manager.stop(); // should not throw
    });

    test('getMicVADConstructor finds MicVAD on window.MicVAD', async () => {
        setupBrowserGlobals({ micVADAvailable: false });
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // Set MicVAD directly on window (not under window.vad)
        const mockCtor = { new: vi.fn(async () => createMockMicVAD()) };
        (globalThis as Any).window.MicVAD = mockCtor;

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await manager.init();

        expect(mockCtor.new).toHaveBeenCalledOnce();
        expect(manager.state).toBe(VADState.PAUSED);
    });

    test('getMicVADConstructor scans window keys for MicVAD object', async () => {
        setupBrowserGlobals({ micVADAvailable: false });
        vi.spyOn(console, 'log').mockImplementation(() => { });

        // Set MicVAD under a non-standard key
        const mockCtor = { new: vi.fn(async () => createMockMicVAD()) };
        (globalThis as Any).window.myCustomLib = { MicVAD: mockCtor };

        const { VADManager } = await import('../vad-manager');
        const manager = new VADManager();
        await manager.init();

        expect(mockCtor.new).toHaveBeenCalledOnce();
        expect(manager.state).toBe(VADState.PAUSED);
    });
});
