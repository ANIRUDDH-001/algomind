/**
 * Unit tests for vad-utils.ts.
 *
 * Run:
 *   npx vitest run src/lib/voice/__tests__/vad-utils.test.ts
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { checkVADSupport, getVADErrorMessage, VAD_SUPPORTED_BROWSERS } from '../vad-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ── Helpers ─────────────────────────────────────────────────────────

let originalWindow: Any;
let originalNavigatorDescriptor: PropertyDescriptor | undefined;
let originalWebAssembly: Any;
let originalAudioContext: Any;

beforeEach(() => {
    originalWindow = (globalThis as Any).window;
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    originalWebAssembly = (globalThis as Any).WebAssembly;
    originalAudioContext = (globalThis as Any).AudioContext;
});

afterEach(() => {
    // Restore window
    if (originalWindow !== undefined) {
        (globalThis as Any).window = originalWindow;
    } else {
        delete (globalThis as Any).window;
    }

    // Restore navigator
    if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    }

    // Restore WebAssembly
    if (originalWebAssembly !== undefined) {
        (globalThis as Any).WebAssembly = originalWebAssembly;
    } else {
        delete (globalThis as Any).WebAssembly;
    }

    // Restore AudioContext
    if (originalAudioContext !== undefined) {
        (globalThis as Any).AudioContext = originalAudioContext;
    } else {
        delete (globalThis as Any).AudioContext;
    }
});

function setupFullBrowser() {
    (globalThis as Any).window = { test: true };
    (globalThis as Any).AudioContext = class MockAudioContext { };
    Object.defineProperty(globalThis, 'navigator', {
        value: {
            mediaDevices: { getUserMedia: async () => ({}) },
        },
        configurable: true,
        writable: true,
    });
    (globalThis as Any).WebAssembly = { validate: () => true };
}

// ── checkVADSupport ─────────────────────────────────────────────────

describe('checkVADSupport', () => {
    test('returns false when window is undefined (SSR)', () => {
        delete (globalThis as Any).window;
        expect(checkVADSupport()).toBe(false);
    });

    test('returns true when all APIs are available', () => {
        setupFullBrowser();
        expect(checkVADSupport()).toBe(true);
    });

    test('returns false without AudioContext', () => {
        setupFullBrowser();
        delete (globalThis as Any).AudioContext;
        expect(checkVADSupport()).toBe(false);
    });

    test('returns true with webkitAudioContext', () => {
        setupFullBrowser();
        delete (globalThis as Any).AudioContext;
        (globalThis as Any).window.webkitAudioContext = class { };
        expect(checkVADSupport()).toBe(true);
    });

    test('returns false without getUserMedia', () => {
        setupFullBrowser();
        Object.defineProperty(globalThis, 'navigator', {
            value: {},
            configurable: true,
            writable: true,
        });
        expect(checkVADSupport()).toBe(false);
    });

    test('returns false without WebAssembly', () => {
        setupFullBrowser();
        delete (globalThis as Any).WebAssembly;
        expect(checkVADSupport()).toBe(false);
    });
});

// ── getVADErrorMessage ──────────────────────────────────────────────

describe('getVADErrorMessage', () => {
    test('maps permission denied error', () => {
        const msg = getVADErrorMessage(new Error('Permission denied'));
        expect(msg.toLowerCase()).toContain('microphone');
    });

    test('maps "not allowed" error', () => {
        const msg = getVADErrorMessage(new Error('The request is not allowed'));
        expect(msg.toLowerCase()).toContain('microphone');
    });

    test('maps AudioContext error', () => {
        const msg = getVADErrorMessage(new Error('AudioContext is not defined'));
        expect(msg.toLowerCase()).toContain('audiocontext');
    });

    test('maps getUserMedia error', () => {
        const msg = getVADErrorMessage(new Error('getUserMedia is not a function'));
        expect(msg.toLowerCase()).toContain('browser');
    });

    test('maps mediaDevices error', () => {
        const msg = getVADErrorMessage(new Error('mediaDevices is undefined'));
        expect(msg.toLowerCase()).toContain('browser');
    });

    test('maps SSR / server-side error', () => {
        const msg = getVADErrorMessage(new Error('Requires a browser environment'));
        expect(msg.toLowerCase()).toContain('browser');
    });

    test('maps ONNX / model errors', () => {
        const msg = getVADErrorMessage(new Error('Failed to load ONNX model'));
        expect(msg.toLowerCase()).toContain('model');
    });

    test('maps WASM error', () => {
        const msg = getVADErrorMessage(new Error('wasm instantiation failed'));
        expect(msg.toLowerCase()).toContain('model');
    });

    test('maps destroyed instance error', () => {
        const msg = getVADErrorMessage(new Error('Instance destroyed'));
        // The actual method returns "shut down" or "refresh" for destroyed
        expect(msg.toLowerCase()).toContain('shut down');
    });

    test('handles non-Error input', () => {
        const msg = getVADErrorMessage('some string');
        expect(msg.toLowerCase()).toContain('unknown');
    });

    test('handles null input', () => {
        const msg = getVADErrorMessage(null);
        expect(msg.toLowerCase()).toContain('unknown');
    });

    test('generic Error with unknown message', () => {
        const msg = getVADErrorMessage(new Error('something weird happened'));
        expect(msg).toContain('something weird happened');
    });
});

// ── VAD_SUPPORTED_BROWSERS ──────────────────────────────────────────

describe('VAD_SUPPORTED_BROWSERS', () => {
    test('is a readonly array of strings', () => {
        expect(Array.isArray(VAD_SUPPORTED_BROWSERS)).toBe(true);
        expect(VAD_SUPPORTED_BROWSERS.length).toBeGreaterThan(0);
    });

    test('includes Chrome', () => {
        expect(VAD_SUPPORTED_BROWSERS.some(b => b.includes('Chrome'))).toBe(true);
    });
});
