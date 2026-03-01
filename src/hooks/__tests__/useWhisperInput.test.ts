// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the WhisperSTT class as a plain class with static method
vi.mock('@/lib/voice/whisper-stt', () => {
    return {
        WhisperSTT: class MockWhisperSTT {
            static isSupported() { return true; }
            transcribeVADAudio = vi.fn().mockResolvedValue(undefined);
        },
    };
});

import { useWhisperInput } from '../useWhisperInput';

describe('useWhisperInput — smoke', () => {
    it('returns correct default shape', () => {
        const { result } = renderHook(() => useWhisperInput());
        expect(result.current).toMatchObject({
            isListening: false,
            transcript: '',
            interimTranscript: '',
            error: null,
            isSupported: true,
        });
        expect(typeof result.current.startListening).toBe('function');
        expect(typeof result.current.stopListening).toBe('function');
        expect(typeof result.current.transcribeVADAudio).toBe('function');
    });

    it('startListening and stopListening do not throw', () => {
        const { result } = renderHook(() => useWhisperInput());
        expect(() => result.current.startListening()).not.toThrow();
        expect(() => result.current.stopListening()).not.toThrow();
    });
});
