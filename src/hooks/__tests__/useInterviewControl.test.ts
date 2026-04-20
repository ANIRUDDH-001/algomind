/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useInterviewControl } from '../useInterviewControl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { InterviewStateMachine } from '@/lib/interview/state-machine';

vi.mock('@/lib/interview/prompts', () => ({
    generateTurnPrompt: vi.fn(),
    generateSystemPrompt: vi.fn(),
    generateInterviewOpeningTrigger: vi.fn(),
    GUEST_INTRO_TEXT: 'Hello guest',
    MAX_USER_INPUT: 1000,
}));

vi.mock('@/lib/interview/interruption-context', () => ({
    buildInterruptionContext: vi.fn()
}));

const mockVoice = {
    transcript: '',
    interimTranscript: '',
    isTranscribing: false,
    permissionState: 'granted' as const,
    sttResolvedProvider: 'browser',
    resetTranscript: vi.fn(),
    vadFailed: false,
    setVadFailed: vi.fn(),
    setVadEnabled: vi.fn(),
    isPushToTalk: false,
    sttProvider: 'browser' as const,
    micIntent: 'off' as const,
    setMicIntent: vi.fn(),
    isMicEnabled: false,
    micStoppedManually: false,
    setMicStoppedManually: vi.fn(),
    toggleMic: vi.fn(),
    sendCountdown: null,
    setSendCountdown: vi.fn(),
    isSpeakingRef: { current: false },
    isListeningRef: { current: false },
    smartPauseActiveRef: { current: false },
    smartPauseTimerRef: { current: null },
    sendCountdownIntervalRef: { current: null },
    ttsError: false,
    setTtsError: vi.fn(),
    isSpeaking: false,
    speak: vi.fn(),
    speakAndWait: vi.fn().mockResolvedValue(true),
    stopSpeaking: vi.fn(),
    ttsProvider: 'browser' as const,
    voiceError: null,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    mediaStreamRef: undefined,
    ttsRef: { current: null },
    interruptionManager: {
        handleAIResponseStart: vi.fn(),
        handleAIResponseComplete: vi.fn(),
        handleUserSpeechStart: vi.fn(),
        handleUserSpeechStartWithConfidence: vi.fn(),
        handleUserSpeechEnd: vi.fn(),
        handleVADFrame: vi.fn(),
        getState: vi.fn().mockReturnValue({}),
        reset: vi.fn(),
        removeAllListeners: vi.fn(),
        on: vi.fn().mockReturnValue(() => {}),
    } as any,
};

const mockMessages = {
    messages: [],
    setMessages: vi.fn(),
    resetMessages: vi.fn(),
    conversationHistoryRef: { current: [] },
    addMessage: vi.fn(),
    loadTranscript: vi.fn(),
    lastUserMsgRef: { current: null }
};

const mockApi = {
    fetchWithRetry: vi.fn(),
    callChatApi: vi.fn().mockResolvedValue('Hello from AI'),
    callChatApiStreaming: vi.fn().mockResolvedValue('Hello from AI'),
    currentStreamMsgIdRef: { current: null },
};

const mockStateMachine = {
    getState: vi.fn().mockReturnValue('idle'),
    transition: vi.fn(),
    reset: vi.fn()
} as unknown as InterviewStateMachine;

const mockOptions = {
    config: { maxTurnsPerProblem: 2, maxDurationMs: 60000 },
};

describe('useInterviewControl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enterCodingMode pauses mic and updates state', () => {
        const stateMachineRef = { current: mockStateMachine };
        const currentProblemRef = { current: null };
        const optionsRef = { current: mockOptions } as any;
        const timeUpRef = { current: false };

        const { result } = renderHook(() => useInterviewControl({
            voice: mockVoice,
            messages: mockMessages,
            api: mockApi,
            stateMachineRef,
            currentProblemRef,
            optionsRef,
            timeUpRef
        }));

        act(() => {
            result.current.enterCodingMode();
        });

        expect(mockStateMachine.transition).toHaveBeenCalledWith('USER_STARTED_CODING');
        expect(mockVoice.setMicIntent).toHaveBeenCalledWith('off');
        expect(mockVoice.stopListening).toHaveBeenCalled();
    });

    it('endInterview stops everything and transitions to SUBMIT_SOLUTION', () => {
        const stateMachineRef = { current: mockStateMachine };
        const currentProblemRef = { current: null };
        const optionsRef = { current: mockOptions } as any;
        const timeUpRef = { current: true };

        const { result } = renderHook(() => useInterviewControl({
            voice: mockVoice,
            messages: mockMessages,
            api: mockApi,
            stateMachineRef,
            currentProblemRef,
            optionsRef,
            timeUpRef
        }));

        // Move out of idle so the guard does not block endInterview
        act(() => {
            result.current.setState('user-thinking');
        });

        act(() => {
            result.current.endInterview();
        });

        expect(mockVoice.setMicIntent).toHaveBeenCalledWith('off');
        expect(mockVoice.stopListening).toHaveBeenCalled();
        expect(mockVoice.stopSpeaking).toHaveBeenCalled();
        expect(mockStateMachine.transition).toHaveBeenCalledWith('SUBMIT_SOLUTION');
    });
});
