// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInterview } from '../useInterview';

// ── WhisperSTT mock — class form with static method ──────────────────────────
vi.mock('../../lib/voice/whisper-stt', () => ({
    WhisperSTT: class {
        static isSupported = () => false;
        transcribeVADAudio = vi.fn().mockResolvedValue(undefined);
    }
}));

// ── Stable mock refs ──────────────────────────────────────────────────────────
const mockStop = vi.fn();
const mockStart = vi.fn();
const mockAbort = vi.fn();
const mockReset = vi.fn();
const mockTranscribeVAD = vi.fn();
const mockSpeak = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockStopSpeaking = vi.fn();

vi.mock('../../hooks/useVoiceInput', () => ({
    useVoiceInput: () => ({
        isListening: false,
        stopListening: mockStop,
        startListening: mockStart,
        abortListening: mockAbort,
        transcript: '',
        interimTranscript: '',
        resetTranscript: mockReset,
        lastResultTime: 0,
        transcribeVADAudio: mockTranscribeVAD,
        error: null,
        isSupported: true,
    }),
}));

vi.mock('../../hooks/useVoiceOutput', () => ({
    useVoiceOutput: () => ({
        speak: mockSpeak,
        pause: mockPause,
        resume: mockResume,
        stop: mockStopSpeaking,
        isSpeaking: false,
    }),
}));

vi.mock('../../hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => false,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useInterview — mic lifecycle', () => {
    const mockConfig: any = {
        mode: 'practice',
        difficultyMode: 'practice',
        maxDurationMs: 1200000,
        maxTurnsPerProblem: 20,
        isUnlimited: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initialises in idle state with mic disabled', () => {
        const { result } = renderHook(() => useInterview({ config: mockConfig }));
        expect(result.current.state).toBe('idle');
        expect(result.current.voice.isListening).toBe(false);
        expect(result.current.voice.isMicEnabled).toBe(false);
    });

    it('does not auto-submit when lastResultTime is 0 (no speech yet)', () => {
        const { result } = renderHook(() => useInterview({ config: mockConfig }));
        expect(result.current.state).toBe('idle');
        expect(mockStart).not.toHaveBeenCalled();
    });

    it('submitUserResponse reference is stable across re-renders', () => {
        const { result, rerender } = renderHook(
            // @ts-ignore
            (props: { config: any; isReviewMode: boolean }) => useInterview(props),
            { initialProps: { config: mockConfig, isReviewMode: false } }
        );

        const ref1 = result.current.submitUserResponse;
        rerender({ config: mockConfig, isReviewMode: true });
        const ref2 = result.current.submitUserResponse;

        expect(ref1).toBe(ref2);
    });

    it('endInterview is a no-op when roundCount < 1', () => {
        const { result } = renderHook(() => useInterview({ config: mockConfig }));
        expect(result.current.roundCount).toBe(0);

        act(() => {
            result.current.endInterview();
        });

        expect(result.current.state).toBe('idle');
    });

    it('voice.startListening sets isMicEnabled to true', () => {
        const { result } = renderHook(() => useInterview({ config: mockConfig }));
        expect(result.current.voice.isMicEnabled).toBe(false);

        act(() => {
            result.current.voice.startListening();
        });

        expect(result.current.voice.isMicEnabled).toBe(true);
    });
});
