/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Unit tests for useVoiceOutput — Groq TTS integration.
 *
 * Strategy (matches useVoiceActivityDetection.test.ts):
 * - Mock 'react' to intercept useState/useEffect/useRef/useCallback
 * - Call hook function directly in Node environment
 * - Test Groq vs browser TTS fallback logic
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Mocks (before imports) ────────────────────────────────────────────────

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: { id: 'user-1', email: 'test@test.com' } }),
}));

vi.mock('@/lib/voice/voice-utils', () => ({
    getProcesedVoices: (v: unknown[]) => v,
    findBestMatchingVoice: () => null,
}));

vi.mock('@/lib/voice/text-chunker', () => ({
    chunkTextForSpeech: (text: string) => [text],
}));

vi.mock('@/lib/voice/tts-preprocessor', () => ({
    preprocessForTTS: (text: string) => text,
}));

vi.mock('@/lib/supabase/user-preferences', () => ({
    getUserPreferences: vi.fn().mockResolvedValue({ voiceRate: 0.9, preferredVoiceName: null }),
}));

// Mock state setters
const mockSetIsSpeaking = vi.fn();
const mockSetIsPaused = vi.fn();
const mockSetAvailableVoices = vi.fn();
const mockSetCurrentVoice = vi.fn();
const mockSetRate = vi.fn();
const mockSetTtsProvider = vi.fn();
const mockSetCurrentProvider = vi.fn();

// Track captured effects and refs
const capturedEffects: (() => void | (() => void))[] = [];
const refs: Record<string, { current: unknown }> = {};

vi.mock('react', () => {
    const ReactMock = {
        useState: vi.fn(),
        useEffect: vi.fn((fn: () => void | (() => void)) => {
            capturedEffects.push(fn);
        }),
        useRef: vi.fn((initial: unknown) => {
            const ref = { current: initial };
            return ref;
        }),
        useCallback: vi.fn((cb: unknown) => cb),
    };
    return { ...ReactMock, default: ReactMock };
});

import React from 'react';

// ─── Browser global mocks ──────────────────────────────────────────────────

const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockSpeechSynthesis = {
    speak: mockSpeak,
    cancel: mockCancel,
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    onvoiceschanged: null,
};

class MockSpeechSynthesisUtterance {
    text: string;
    voice: unknown = null;
    rate = 1; pitch = 1; volume = 1;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(text: string) { this.text = text; }
}

// AudioContext mocks
const mockDecodeAudioData = vi.fn();
const mockStart = vi.fn();
const mockSourceStop = vi.fn();
const mockSuspend = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn();

class MockAudioContext {
    state = 'running';
    destination = {};
    decodeAudioData = mockDecodeAudioData;
    createBufferSource = vi.fn(() => ({
        buffer: null, connect: mockConnect, start: mockStart,
        stop: mockSourceStop, onended: null as (() => void) | null,
    }));
    suspend = mockSuspend;
    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
}

// ─── Import ────────────────────────────────────────────────────────────────

import { useVoiceOutput } from '../useVoiceOutput';

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupDefaultState() {
    capturedEffects.length = 0;
    // Order matches hook's useState calls:
    // 1. isSpeaking, 2. isPaused, 3. availableVoices, 4. currentVoice,
    // 5. rate, 6. ttsProvider, 7. currentProvider
    (React.useState as Mock)
        .mockReturnValueOnce([false, mockSetIsSpeaking])
        .mockReturnValueOnce([false, mockSetIsPaused])
        .mockReturnValueOnce([[], mockSetAvailableVoices])
        .mockReturnValueOnce([null, mockSetCurrentVoice])
        .mockReturnValueOnce([0.9, mockSetRate])
        .mockReturnValueOnce(['detecting', mockSetTtsProvider])
        .mockReturnValueOnce(['browser', mockSetCurrentProvider]);
}

// Set up global mocks
function setupGlobals() {
    (globalThis as Record<string, unknown>).window = { speechSynthesis: mockSpeechSynthesis, SpeechSynthesisUtterance: MockSpeechSynthesisUtterance } as unknown;
    (globalThis as Record<string, unknown>).speechSynthesis = mockSpeechSynthesis;
    (globalThis as Record<string, unknown>).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as Record<string, unknown>).AudioContext = MockAudioContext;
    (globalThis as Record<string, unknown>).fetch = vi.fn();
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useVoiceOutput — Groq TTS integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedEffects.length = 0;
        setupGlobals();
    });

    it('uses browser TTS when /api/voice/synthesize returns 503', async () => {
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false, status: 503,
        });

        setupDefaultState();
        const result = useVoiceOutput();

        // Run the detection effect (first useEffect that calls fetch)
        for (const effect of capturedEffects) {
            effect();
        }

        // Wait for the async fetch to settle
        await vi.waitFor(() => {
            expect(mockSetTtsProvider).toHaveBeenCalledWith('browser');
        });
    });

    it('detects Groq TTS as available when API returns 200', async () => {
        const fakeAudioBuffer = new ArrayBuffer(16);
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true, status: 200, arrayBuffer: async () => fakeAudioBuffer,
        });

        setupDefaultState();
        const result = useVoiceOutput();

        for (const effect of capturedEffects) {
            effect();
        }

        await vi.waitFor(() => {
            expect(mockSetTtsProvider).toHaveBeenCalledWith('groq');
        });
    });

    it('falls back to browser on Groq network error', async () => {
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

        setupDefaultState();
        useVoiceOutput();

        for (const effect of capturedEffects) {
            effect();
        }

        await vi.waitFor(() => {
            expect(mockSetTtsProvider).toHaveBeenCalledWith('browser');
        });
    });

    it('currentProvider is set to "groq" when speakWithGroq succeeds', async () => {
        const fakeAudioBuffer = new ArrayBuffer(16);
        const fakeDecodedBuffer = { duration: 1 };

        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true, status: 200, arrayBuffer: async () => fakeAudioBuffer,
        });
        mockDecodeAudioData.mockResolvedValue(fakeDecodedBuffer);

        // Set ttsProvider to 'groq' so speak() takes the Groq path
        (React.useState as Mock)
            .mockReturnValueOnce([false, mockSetIsSpeaking])
            .mockReturnValueOnce([false, mockSetIsPaused])
            .mockReturnValueOnce([[], mockSetAvailableVoices])
            .mockReturnValueOnce([null, mockSetCurrentVoice])
            .mockReturnValueOnce([0.9, mockSetRate])
            .mockReturnValueOnce(['groq', mockSetTtsProvider])
            .mockReturnValueOnce(['browser', mockSetCurrentProvider]);

        // Set the groqAvailableRef to true by mocking useRef calls
        // Order: queueRef, processingRef, audioContextRef, sourceNodeRef, groqAvailableRef
        let groqRef: { current: boolean | null };
        let sourceRef: { current: { stop: Mock; onended: (() => void) | null } | null };
        (React.useRef as Mock)
            .mockReturnValueOnce({ current: [] })               // queueRef
            .mockReturnValueOnce({ current: false })             // processingRef
            .mockReturnValueOnce({ current: null })              // audioContextRef
            .mockImplementationOnce(() => {                      // sourceNodeRef
                sourceRef = { current: null };
                return sourceRef;
            })
            .mockImplementationOnce(() => {                      // groqAvailableRef
                groqRef = { current: true };
                return groqRef;
            });

        const result = useVoiceOutput();

        // Start playback — will fire the onended callback synchronously from mocked AudioContext
        mockStart.mockImplementation(function (this: { onended: (() => void) | null }) {
            // Fire onended immediately to resolve the promise
            if (sourceRef!.current?.onended) {
                sourceRef!.current.onended();
            }
        });

        await result.speak('Test Groq audio');

        expect(mockSetCurrentProvider).toHaveBeenCalledWith('groq');
        expect(mockDecodeAudioData).toHaveBeenCalled();
    });

    it('currentProvider stays "browser" when Groq TTS fails', async () => {
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: false, status: 503,
        });

        setupDefaultState();
        useVoiceOutput();

        for (const effect of capturedEffects) {
            effect();
        }

        await vi.waitFor(() => {
            expect(mockSetTtsProvider).toHaveBeenCalledWith('browser');
        });
        // currentProvider should not have been set to 'groq'
        expect(mockSetCurrentProvider).not.toHaveBeenCalledWith('groq');
    });

    it('stop() calls AudioContext.suspend()', () => {
        // Set up with groq provider active
        (React.useState as Mock)
            .mockReturnValueOnce([true, mockSetIsSpeaking])     // isSpeaking = true
            .mockReturnValueOnce([false, mockSetIsPaused])
            .mockReturnValueOnce([[], mockSetAvailableVoices])
            .mockReturnValueOnce([null, mockSetCurrentVoice])
            .mockReturnValueOnce([0.9, mockSetRate])
            .mockReturnValueOnce(['groq', mockSetTtsProvider])
            .mockReturnValueOnce(['groq', mockSetCurrentProvider]);

        const mockCtx = new MockAudioContext();
        const mockSource = { stop: mockSourceStop, onended: null, buffer: null, connect: mockConnect, start: mockStart };

        (React.useRef as Mock)
            .mockReturnValueOnce({ current: [] })                // queueRef
            .mockReturnValueOnce({ current: true })              // processingRef (active)
            .mockReturnValueOnce({ current: mockCtx })           // audioContextRef
            .mockReturnValueOnce({ current: mockSource })        // sourceNodeRef
            .mockReturnValueOnce({ current: true });             // groqAvailableRef

        const result = useVoiceOutput();
        result.stop();

        expect(mockSourceStop).toHaveBeenCalled();
        expect(mockSuspend).toHaveBeenCalled();
        expect(mockSetIsSpeaking).toHaveBeenCalledWith(false);
    });
});
