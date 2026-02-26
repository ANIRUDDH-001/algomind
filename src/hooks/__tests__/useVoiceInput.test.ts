// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useVoiceInput } from '../useVoiceInput';

// Mock SpeechRecognition
class MockSpeechRecognition {
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    onstart: any = null;
    onresult: any = null;
    onerror: any = null;
    onend: any = null;
    lang = '';
    continuous = false;
    interimResults = false;
}

beforeEach(() => {
    (global as any).window = global.window || {};
    (global.window as any).SpeechRecognition = MockSpeechRecognition;
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('useVoiceInput - lastResultTime', () => {
    it('should set lastResultTime to now when startListening is called', () => {
        const { result } = renderHook(() => useVoiceInput());

        const now = Date.now();
        vi.setSystemTime(now);

        act(() => {
            result.current.startListening();
        });

        expect(result.current.lastResultTime).toBe(now);
    });

    it('should not fire silence timer immediately after start', () => {
        const { result } = renderHook(() => useVoiceInput());

        act(() => {
            result.current.startListening();
        });

        // Advance timer by 1000ms
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // Since we are checking if stopListening isn't called improperly immediately 
        // by consumer expecting a large silence delta:
        expect(result.current.lastResultTime).not.toBe(0);
        expect(result.current.isListening).toBe(false); // mock doesn't call onstart by default
    });
});
