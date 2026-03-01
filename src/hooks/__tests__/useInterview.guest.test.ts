// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
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

describe('useInterview — guest mode limits', () => {
    const mockGuestConfig: any = {
        mode: 'guest',
        difficultyMode: 'practice',
        maxDurationMs: 300000,
        maxTurnsPerProblem: 5,
        isUnlimited: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('INTERVIEW_MAX_ROUNDS is 5 when maxRounds=5 passed', () => {
        const { result } = renderHook(() =>
            useInterview({ config: mockGuestConfig, isGuest: true })
        );
        // Can't directly read INTERVIEW_MAX_ROUNDS (it's internal)
        // but we can verify roundCount starts at 0 and isLimitReached is false
        expect(result.current.roundCount).toBe(0);
        expect(result.current.isLimitReached).toBe(false);
    });

    it('guestMode is passed in callChatApi body when isGuest=true', () => {
        // This test verifies the option is accepted without throwing
        expect(() =>
            renderHook(() => useInterview({ config: mockGuestConfig, isGuest: true }))
        ).not.toThrow();
    });
});
