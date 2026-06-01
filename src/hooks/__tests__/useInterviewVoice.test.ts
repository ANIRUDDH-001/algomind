/**
 * @codesage
 * @file      src/hooks/__tests__/useInterviewVoice.test.ts
 * @purpose   Unit tests for the useInterviewVoice React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useInterviewVoice
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useInterviewVoice } from '../useInterviewVoice';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useTTS', () => ({
    useTTS: () => ({
        isSpeaking: false,
        speak: vi.fn(),
        speakAndWait: vi.fn(),
        stop: vi.fn(),
        provider: 'browser',
    })
}));

vi.mock('@/hooks/useSTT', () => ({
    useSTT: () => ({
        isListening: false,
        isTranscribing: false,
        startListening: vi.fn(),
        stopListening: vi.fn(),
        resetTranscript: vi.fn(),
        permissionState: 'granted',
        resolvedProvider: 'browser',
        mediaStreamRef: { current: null },
    })
}));

vi.mock('@/hooks/useVAD', () => ({
    useVAD: vi.fn()
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => true
}));

const mockVoiceOptions = {
    onSpeechEnd: vi.fn(),
    onVADFallback: vi.fn()
};

describe('useInterviewVoice', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('toggleMic transitions micIntent from off to user-on', () => {
        const { result } = renderHook(() => useInterviewVoice(mockVoiceOptions));
        expect(result.current.micIntent).toBe('off');
        act(() => result.current.toggleMic());
        expect(result.current.micIntent).toBe('user-on');
    });

    it('isMicEnabled is true for user-on and auto-on', () => {
        const { result } = renderHook(() => useInterviewVoice(mockVoiceOptions));
        act(() => result.current.setMicIntent('auto-on'));
        expect(result.current.isMicEnabled).toBe(true);
    });
});
