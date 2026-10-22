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
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const useInterviewSpy = vi.fn();
const startInterview = vi.fn();
const unlockMock = vi.fn();
let mockBlocked = false;
const toggleMuteMock = vi.fn();
const stopSpeakingMock = vi.fn();
const handleInterruptionMock = vi.fn();
const submitUserResponseMock = vi.fn();
let mockIsProcessing = false;
let mockVoice: Record<string, unknown> = {};
let mockVoiceEnabled = true;

vi.mock('@/hooks/useInterview', () => ({
  useInterview: (opts: unknown) => {
    useInterviewSpy(opts);
    return {
      state: 'idle',
      messages: [],
      isProcessing: mockIsProcessing,
      startInterview,
      resetInterview: vi.fn(),
      submitUserResponse: submitUserResponseMock,
      handleInterruption: handleInterruptionMock,
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
      voiceEnabled: mockVoiceEnabled,
      voice: {
        unlock: unlockMock,
        blocked: mockBlocked,
        isListening: false,
        isSpeaking: false,
        transcript: '',
        interimTranscript: '',
        startListening: vi.fn(),
        stopListening: vi.fn(),
        stopSpeaking: stopSpeakingMock,
        toggleMute: toggleMuteMock,
        isMuted: false,
        error: null,
        ...mockVoice,
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
vi.mock('@/components/interview/GuestProblemSelectorModal', () => ({
  GuestProblemSelectorModal: ({ isOpen, onSelect }: { isOpen: boolean; onSelect: (p: unknown) => void }) => isOpen
    ? <button data-testid="guest-pick" onClick={() => onSelect({ id: 'g1', title: 'Two Sum', description: 'Find pair sum.', difficulty: 'easy', examples: [] })}>pick</button>
    : null,
}));
vi.mock('@/components/interview/VoiceOnboarding', () => ({ VoiceOnboarding: () => <div data-testid="voice-onboarding" /> }));
vi.mock('@/components/voice/MicrophoneButton', () => ({
  MicrophoneButton: (p: { onClick(): void; disabled?: boolean; isMuted?: boolean }) => (
    <button data-testid="mic" onClick={p.onClick} disabled={p.disabled}>{p.isMuted ? 'Muted' : 'Mic'}</button>
  ),
}));
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
    mockIsProcessing = false;
    mockVoice = {};
    mockVoiceEnabled = true;
  });
  afterEach(cleanup);

  it('both pre-start screens link to /voice-check (new tab) only when voice is on', () => {
    const { unmount } = render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    const links = screen.getAllByRole('link', { name: /check mic & speaker/i });
    expect(links).toHaveLength(2); // desktop + mobile pre-start screens
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/voice-check');
      expect(link.getAttribute('target')).toBe('_blank');
    }
    unmount();
    mockVoiceEnabled = false;
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    expect(screen.queryByRole('link', { name: /check mic & speaker/i })).toBeNull();
  });

  it('the voice tutorial shows before Begin when voice is on — never over the live interview, never in text-only mode', async () => {
    const { unmount } = render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    expect(screen.getAllByTestId('voice-onboarding')).toHaveLength(1);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    await screen.findAllByTestId('mic');                         // the interview is live: Kai talking, mic armed
    expect(screen.queryAllByTestId('voice-onboarding')).toHaveLength(0);
    unmount();

    mockVoiceEnabled = false;
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    expect(screen.queryAllByTestId('voice-onboarding')).toHaveLength(0);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    await screen.findAllByRole('textbox', { name: 'Your answer' });
    expect(screen.queryAllByTestId('voice-onboarding')).toHaveLength(0);
  });

  it('a guest gets the voice tutorial only after picking a problem — never over the problem picker', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} isGuest />);
    expect(screen.getByTestId('guest-pick')).toBeTruthy();
    expect(screen.queryAllByTestId('voice-onboarding')).toHaveLength(0);
    fireEvent.click(screen.getByTestId('guest-pick'));
    expect(screen.getAllByTestId('voice-onboarding')).toHaveLength(1);
  });

  it('every mic button (desktop + mobile) toggles mute and stays enabled while Kai is thinking', async () => {
    mockIsProcessing = true;
    mockVoice = { isMuted: true };
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    const mics = (await screen.findAllByTestId('mic')) as HTMLButtonElement[];
    expect(mics).toHaveLength(2);
    for (const mic of mics) {
      expect(mic.disabled).toBe(false);
      expect(mic.textContent).toBe('Muted');
      fireEvent.click(mic);
    }
    expect(toggleMuteMock).toHaveBeenCalledTimes(2);
    expect(handleInterruptionMock).not.toHaveBeenCalled();
  });

  it('text-only mode shows the typed composer in every layout (desktop + mobile)', async () => {
    mockVoiceEnabled = false;
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    expect(await screen.findAllByRole('textbox', { name: 'Your answer' })).toHaveLength(2);
    expect(screen.queryAllByTestId('mic')).toHaveLength(0);
  });

  it('Esc stops Kai speaking', () => {
    mockVoice = { isSpeaking: true };
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stopSpeakingMock).toHaveBeenCalled();
    expect(handleInterruptionMock).toHaveBeenCalled();
  });

  it('Esc does nothing while Kai is silent', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(stopSpeakingMock).not.toHaveBeenCalled();
  });

  it('shows Send Message in every layout whenever a transcript exists and sends it immediately', async () => {
    mockVoice = { transcript: 'I would use a hash map' };
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    const sends = await screen.findAllByRole('button', { name: /send message/i });
    expect(sends).toHaveLength(2);
    fireEvent.click(sends[0]);
    expect(submitUserResponseMock).toHaveBeenCalledWith('I would use a hash map', expect.objectContaining({ problemTitle: 'Two Sum' }));
  });

  it('passes interviewConfig and onUserMessage callback into useInterview', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    expect(useInterviewSpy).toHaveBeenCalled();
    const arg = useInterviewSpy.mock.calls[0]?.[0] as any;
    expect(arg.config).toBe(config);
    expect(typeof arg.onUserMessage).toBe('function');
  });

  it('unlocks the speech engine synchronously inside the Start click', () => {
    unlockMock.mockClear();
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.click(screen.getAllByTestId('begin-interview-btn')[0]);
    expect(unlockMock).toHaveBeenCalledTimes(1);
  });

  it("shows a tap-to-enable banner when the browser blocked Kai's voice", () => {
    mockBlocked = true;
    unlockMock.mockClear();
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    fireEvent.click(screen.getAllByRole('button', { name: /tap to enable/i })[0]);
    expect(unlockMock).toHaveBeenCalled();
    mockBlocked = false;
  });

  it('renders begin CTA in orchestrator view and is clickable', () => {
    render(<InterviewSession problem={problem as any} interviewConfig={config} />);
    const begin = screen.getAllByTestId('begin-interview-btn')[0];
    expect(begin).toBeTruthy();
    fireEvent.click(begin);
    expect((begin as HTMLButtonElement).disabled).toBe(false);
  });
});
