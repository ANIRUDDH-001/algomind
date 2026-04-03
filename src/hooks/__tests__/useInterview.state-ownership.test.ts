// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInterview } from '../useInterview';

const startListeningMock = vi.fn();
const stopListeningMock = vi.fn();
const resetTranscriptMock = vi.fn();
const stopSpeakingMock = vi.fn();

vi.mock('@/hooks/useSTT', () => ({
  useSTT: () => ({
    isListening: false,
    isTranscribing: false,
    transcript: '',
    interimTranscript: '',
    startListening: startListeningMock,
    stopListening: stopListeningMock,
    resetTranscript: resetTranscriptMock,
    transcribeAudio: vi.fn(),
    permissionState: 'granted',
    resolvedProvider: 'browser',
    mediaStreamRef: { current: null },
  }),
}));

vi.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({
    isSpeaking: false,
    speak: vi.fn(),
    speakAndWait: vi.fn().mockResolvedValue(true),
    stop: stopSpeakingMock,
    provider: 'browser',
  }),
}));

vi.mock('@/hooks/useVAD', () => ({
  useVAD: () => ({
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
  useGlobalFeatureFlag: () => false,
}));

vi.mock('@/lib/voice/language-detector', () => ({
  detectSpokenLanguage: vi.fn().mockReturnValue('english'),
}));

vi.mock('@/lib/interview/prompts', () => ({
  generateSystemPrompt: vi.fn().mockReturnValue('system'),
  generateTurnPrompt: vi.fn().mockReturnValue('turn'),
  generateInterviewOpeningTrigger: vi.fn().mockReturnValue('opening'),
  GUEST_INTRO_TEXT: 'guest',
  MAX_USER_INPUT: 1000,
}));

vi.mock('@/lib/interview/interruption-context', () => ({
  buildInterruptionContext: vi.fn().mockReturnValue(undefined),
}));

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }));

describe('useInterview state ownership contract', () => {
  const baseConfig: any = {
    mode: 'practice',
    difficultyMode: 'practice',
    maxDurationMs: 60000,
    maxTurnsPerProblem: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('voice.startListening only changes intent state and does not mutate message state', () => {
    const { result } = renderHook(() => useInterview({ config: baseConfig }));

    expect(result.current.micIntent).toBe('off');
    expect(result.current.messages).toEqual([]);

    act(() => {
      result.current.voice.startListening();
    });

    expect(result.current.micIntent).toBe('user-on');
    expect(result.current.messages).toEqual([]);
  });

  it('resetInterview owns cross-domain cleanup boundaries', () => {
    const { result } = renderHook(() => useInterview({ config: baseConfig }));

    act(() => {
      result.current.voice.startListening();
      result.current.resetInterview();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.micIntent).toBe('off');
    expect(result.current.roundCount).toBe(0);
    expect(result.current.isLimitReached).toBe(false);
    expect(stopListeningMock).toHaveBeenCalled();
    expect(resetTranscriptMock).toHaveBeenCalled();
  });
});
