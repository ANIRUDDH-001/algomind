/**
 * @codesage
 * @file      src/components/interview/__tests__/InterviewSession.orchestrator.test.tsx
 * @purpose   Tests for InterviewSession orchestrator view.
 * @tech      Vitest, React Testing Library
 * @connects  ../InterviewSession
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const useInterviewSpy = vi.fn();
const startInterview = vi.fn();

vi.mock('@/hooks/useInterview', () => ({
  useInterview: (opts: unknown) => {
    useInterviewSpy(opts);
    return {
      state: 'idle',
      messages: [],
      isProcessing: false,
      startInterview,
      resetInterview: vi.fn(),
      submitUserResponse: vi.fn(),
      handleInterruption: vi.fn(),
      endInterview: vi.fn(),
      loadTranscript: vi.fn(),
      roundCount: 0,
      interviewStartTime: null,
      isLimitReached: false,
      limitReason: null,
      micIntent: 'off',
      ttsError: false,
      isPushToTalk: false,
      enterCodingMode: vi.fn(),
      exitCodingMode: vi.fn(),
      shareCode: vi.fn(),
      voice: {
        isListening: false,
        isSpeaking: false,
        transcript: '',
        interimTranscript: '',
        startListening: vi.fn(),
        stopListening: vi.fn(),
        stopSpeaking: vi.fn(),
        error: null,
      },
    };
  },
}));

vi.mock('@/hooks/useAssessment', () => ({
  useAssessment: () => ({ analyzeSession: vi.fn(), isAnalyzing: false, result: null, reset: vi.fn() }),
}));

vi.mock('@/hooks/useInterviewLimits', () => ({
  useInterviewLimits: () => ({
    incrementTurn: vi.fn(),
    startTimer: vi.fn(),
    stopTimer: vi.fn(),
    isTimeUp: false,
    isTurnsUp: false,
    timeRemaining: 1200,
    formattedElapsed: '00:00',
    shouldShowTurnWarning: false,
    turnsRemaining: 20,
    formattedTotal: '20:00',
    isHalfTime: false,
  }),
}));

vi.mock('@/hooks/useGuestSession', () => ({
  useGuestSession: () => ({
    recordUserTurn: vi.fn(),
    recordAITurn: vi.fn(),
    isTrialComplete: false,
    showLoginPrompt: false,
    userTurns: 0,
    aiTurns: 0,
    reset: vi.fn(),
  }),
  GUEST_SESSION_LIMITS: { MAX_USER_TURNS: 5 },
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
  useGlobalFeatureFlag: () => false,
}));

vi.mock('@/hooks/useSwipeNavigation', () => ({
  useSwipeNavigation: () => ({ handlers: {}, currentIndex: 1 }),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <div />,
}));

vi.mock('@/components/interview/ConversationView', () => ({ ConversationView: () => <div /> }));
vi.mock('@/components/interview/InterviewLimitBar', () => ({ InterviewLimitBar: () => <div /> }));
vi.mock('@/components/interview/GuestModeBanner', () => ({ GuestModeBanner: () => <div /> }));
vi.mock('@/components/interview/GuestResultsOverlay', () => ({ GuestResultsOverlay: () => <div /> }));
vi.mock('@/components/interview/GuestProblemSelectorModal', () => ({ GuestProblemSelectorModal: () => <div /> }));
vi.mock('@/components/interview/VoiceOnboarding', () => ({ VoiceOnboarding: () => <div /> }));
vi.mock('@/components/voice/MicrophoneButton', () => ({ MicrophoneButton: () => <button /> }));
vi.mock('@/components/voice/MicPulse', () => ({ MicPulse: () => <div /> }));
vi.mock('@/components/voice/ZoomTranscript', () => ({ ZoomTranscript: () => <div /> }));
vi.mock('@/components/voice/LiveTranscript', () => ({ LiveTranscript: () => <div /> }));
vi.mock('@/components/assessment/AssessmentLoader', () => ({ AssessmentLoader: () => <div /> }));
vi.mock('@/components/ui/ErrorBanner', () => ({ ErrorBanner: () => <div /> }));
vi.mock('@/components/interview/CodeEditor', () => ({ CodeEditor: () => <div /> }));
vi.mock('@/components/interview/TestCasePanel', () => ({
  TestCasePanel: () => <div />,
  buildKaiExecutionContext: vi.fn(() => 'ctx'),
  matchResults: vi.fn(() => []),
}));
vi.mock('@/app/actions/save-session', () => ({ saveInterviewSession: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('@/components/interview/GuestRegisterModal', () => ({ GuestRegisterModal: () => <div /> }));
vi.mock('@/components/interview/InterviewHeader', () => ({ InterviewHeader: () => <div /> }));
vi.mock('@/components/interview/SilentObserverNudge', () => ({ SilentObserverNudge: () => <div /> }));
vi.mock('@/lib/interview/silent-observer', () => ({
  SilentObserver: class {
    analyze() {
      return Promise.resolve({});
    }
    reset() {}
  },
}));
vi.mock('@/lib/analytics/voice-analytics', () => ({ voiceAnalytics: { track: vi.fn() } }));
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    }),
  }),
}));
vi.mock('@/lib/supabase/problems', () => ({ getProblemById: vi.fn().mockResolvedValue(null) }));
vi.mock('sonner', () => ({ toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() } }));

import { InterviewSession } from '../InterviewSession';

describe('InterviewSession orchestrator contract', () => {
  const problem = {
    id: 'p1',
    title: 'Two Sum',
    description: 'Find pair sum.',
    difficulty: 'easy' as const,
    examples: [],
  };

  const config = {
    mode: 'practice',
    difficultyMode: 'practice',
    maxTurnsPerProblem: 20,
    maxDurationMs: 20 * 60 * 1000,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes interviewConfig and onUserMessage callback into useInterview', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    expect(useInterviewSpy).toHaveBeenCalled();
    const arg = useInterviewSpy.mock.calls[0]?.[0] as any;
    expect(arg.config).toBe(config);
    expect(typeof arg.onUserMessage).toBe('function');
  });

  it('renders begin CTA in orchestrator view and is clickable', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    const begin = screen.getAllByTestId('begin-interview-btn')[0];
    expect(begin).toBeTruthy();
    fireEvent.click(begin);
    expect((begin as HTMLButtonElement).disabled).toBe(false);
  });
});
