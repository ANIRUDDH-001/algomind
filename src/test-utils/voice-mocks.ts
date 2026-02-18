/**
 * Shared mock factories for browser voice/audio APIs.
 *
 * Usage:
 *   import { setupBrowserEnvironment, teardownBrowserEnvironment, createMockMicVAD } from '@/test-utils/voice-mocks';
 *
 *   beforeEach(() => setupBrowserEnvironment());
 *   afterEach(() => teardownBrowserEnvironment());
 *
 * @module voice-mocks
 */

import { vi } from 'vitest';

// ── Types ───────────────────────────────────────────────────────────

export interface MockMicVAD {
    listening: boolean;
    start: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
}

export interface MockSpeechSynthesisInstance {
    speak: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    getVoices: ReturnType<typeof vi.fn>;
    speaking: boolean;
    paused: boolean;
    pending: boolean;
}

// ── Mock SpeechSynthesis ────────────────────────────────────────────

export function createMockSpeechSynthesis(): MockSpeechSynthesisInstance {
    return {
        speak: vi.fn((utterance: { onend?: (() => void) | null }) => {
            // Auto-end by default
            setTimeout(() => utterance.onend?.(), 0);
        }),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        getVoices: vi.fn(() => []),
        speaking: false,
        paused: false,
        pending: false,
    };
}

export class MockSpeechSynthesisUtterance {
    text: string;
    voice: SpeechSynthesisVoice | null = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    error = '';

    constructor(text: string) {
        this.text = text;
    }
}

// ── Mock AudioContext ───────────────────────────────────────────────

export function createMockAudioContext() {
    return {
        state: 'running' as AudioContextState,
        sampleRate: 16000,
        createMediaStreamSource: vi.fn(() => ({
            connect: vi.fn(),
            disconnect: vi.fn(),
        })),
        createGain: vi.fn(() => ({
            gain: { value: 1 },
            connect: vi.fn(),
            disconnect: vi.fn(),
        })),
        createAnalyser: vi.fn(() => ({
            fftSize: 2048,
            frequencyBinCount: 1024,
            getByteFrequencyData: vi.fn(),
            connect: vi.fn(),
            disconnect: vi.fn(),
        })),
        close: vi.fn(),
        resume: vi.fn(() => Promise.resolve()),
        suspend: vi.fn(() => Promise.resolve()),
        audioWorklet: {
            addModule: vi.fn(() => Promise.resolve()),
        },
    };
}

// ── Mock MediaStream ────────────────────────────────────────────────

export function createMockMediaStream() {
    const track = {
        kind: 'audio',
        enabled: true,
        stop: vi.fn(),
        getSettings: vi.fn(() => ({ sampleRate: 16000 })),
    };

    return {
        stream: {
            getAudioTracks: vi.fn(() => [track]),
            getTracks: vi.fn(() => [track]),
        },
        track,
    };
}

// ── Mock MicVAD ─────────────────────────────────────────────────────

export function createMockMicVAD(): MockMicVAD {
    return {
        listening: false,
        start: vi.fn(async function (this: MockMicVAD) {
            this.listening = true;
        }),
        pause: vi.fn(async function (this: MockMicVAD) {
            this.listening = false;
        }),
        destroy: vi.fn(async function (this: MockMicVAD) {
            this.listening = false;
        }),
    };
}

// ── Browser Environment Setup ───────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

let savedWindow: Any;
let savedNavigatorDescriptor: PropertyDescriptor | undefined;

/**
 * Set up a minimal browser environment for voice tests.
 * Call in beforeEach.
 */
export function setupBrowserEnvironment() {
    savedWindow = (globalThis as Any).window;
    savedNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    const mockSynth = createMockSpeechSynthesis();
    const mockAudioCtx = createMockAudioContext();

    (globalThis as Any).window = {
        speechSynthesis: mockSynth,
        AudioContext: class { constructor() { return mockAudioCtx as Any; } },
    };

    (globalThis as Any).AudioContext = (globalThis as Any).window.AudioContext;
    (globalThis as Any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;

    Object.defineProperty(globalThis, 'navigator', {
        value: {
            mediaDevices: {
                getUserMedia: async () => createMockMediaStream().stream,
            },
            userAgent: 'Mozilla/5.0 (Tests) Chrome/120',
        },
        configurable: true,
        writable: true,
    });

    (globalThis as Any).WebAssembly = { validate: () => true };

    return { mockSynth, mockAudioCtx };
}

/**
 * Tear down the browser environment.
 * Call in afterEach.
 */
export function teardownBrowserEnvironment() {
    if (savedWindow !== undefined) {
        (globalThis as Any).window = savedWindow;
    } else {
        delete (globalThis as Any).window;
    }

    if (savedNavigatorDescriptor) {
        Object.defineProperty(globalThis, 'navigator', savedNavigatorDescriptor);
    }

    delete (globalThis as Any).AudioContext;
    delete (globalThis as Any).SpeechSynthesisUtterance;
    delete (globalThis as Any).WebAssembly;
}

// ── Utilities ───────────────────────────────────────────────────────

/** Flush the microtask queue. */
export function flushPromises(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}

/** Wait N ticks (useful for chained microtasks). */
export async function waitForTicks(n = 1): Promise<void> {
    for (let i = 0; i < n; i++) {
        await flushPromises();
    }
}
