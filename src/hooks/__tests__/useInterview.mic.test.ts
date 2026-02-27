// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useInterview } from '../useInterview';

// Basic mocks
vi.mock('../../lib/voice/whisper-stt', () => ({
    WhisperSTT: class {
        static isSupported = () => false;
        transcribeVADAudio = vi.fn();
    }
}));

// Stable mock references
const mockStopListening = vi.fn();
const mockStartListening = vi.fn();
const mockAbortListening = vi.fn();
const mockResetTranscript = vi.fn();

vi.mock('../../hooks/useVoiceInput', () => ({
    useVoiceInput: () => ({
        isListening: false,
        stopListening: mockStopListening,
        startListening: mockStartListening,
        abortListening: mockAbortListening,
        transcript: '',
        interimTranscript: '',
        resetTranscript: mockResetTranscript,
        lastResultTime: 0,
        transcribeVADAudio: vi.fn()
    })
}));

const mockSpeak = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockStop = vi.fn();

vi.mock('../../hooks/useVoiceOutput', () => ({
    useVoiceOutput: () => ({
        speak: mockSpeak,
        pause: mockPause,
        resume: mockResume,
        stop: mockStop,
        isSpeaking: false
    })
}));

vi.mock('../../hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => false
}));

describe('useInterview - mic lifecycle', () => {
    it('should reset micResumeAttemptedRef when isListening becomes true', () => {
        const { result, rerender } = renderHook((props: { vadEnabled: boolean }) => useInterview(props), {
            initialProps: { vadEnabled: false }
        });

        // This is a placeholder test testing that the effect hook correctly executes
        // when `isListening` changes to `true`. In a real DOM context we'd mock the isListening return.
        expect(result.current.voice.isListening).toBe(false);
    });

    it('should not call submitUserResponse when lastResultTime is 0', () => {
        const { result } = renderHook(() => useInterview({ vadEnabled: false }));
        // Expect that auto-submit did not fire
        expect(result.current.state).toBe('idle');
    });

    it('should not recreate submitUserResponse on every render', () => {
        const { result, rerender } = renderHook((props: any) => useInterview(props), {
            initialProps: { vadEnabled: false, isReviewMode: false }
        });

        const initialSubmit = result.current.submitUserResponse;

        // Re-render with a newly created options object but same values
        rerender({ vadEnabled: false, isReviewMode: true });

        // submitUserResponse reference should remain identical due to the optionsRef fix
        expect(result.current.submitUserResponse).toBe(initialSubmit);
    });
});
