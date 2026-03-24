// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockStartInterview = vi.fn();
const mockResetInterview = vi.fn();
const mockSubmitUserResponse = vi.fn();
const mockHandleInterruption = vi.fn();
const mockLoadTranscript = vi.fn();
const mockEnterCodingMode = vi.fn();
const mockExitCodingMode = vi.fn();
const mockShareCode = vi.fn();
const mockEndInterview = vi.fn();

const mockVoice = {
    isListening: false,
    isSpeaking: false,
    error: null,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    stopSpeaking: vi.fn(),
    transcript: '',
    interimTranscript: '',
};

const mockInterviewState = {
    state: 'idle',
    messages: [],
    isProcessing: false,
    roundCount: 0,
    interviewStartTime: null,
    isLimitReached: false,
    limitReason: null,
    micStoppedManually: false,
    sendCountdown: null,
    ttsError: false,
    isPushToTalk: false,
};

// ─── jsdom polyfills ───
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
Element.prototype.scrollIntoView = vi.fn();

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, style, 'data-testid': testId }: any) => (
            <div className={className} style={style} data-testid={testId}>{children}</div>
        ),
        button: ({ children, className, style, onClick, disabled, 'data-testid': testId }: any) => (
            <button className={className} style={style} onClick={onClick} disabled={disabled} data-testid={testId}>
                {children}
            </button>
        ),
        span: ({ children, className }: any) => <span className={className}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// ─── Mock next/navigation ───
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

// ─── Mock auth ───
const mockAuthUser = { id: 'test-user' };
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: mockAuthUser }),
}));

// ─── Mock all hooks ───
vi.mock('@/hooks/useInterview', () => ({
    useInterview: () => ({
        ...mockInterviewState,
        startInterview: mockStartInterview,
        resetInterview: mockResetInterview,
        submitUserResponse: mockSubmitUserResponse,
        handleInterruption: mockHandleInterruption,
        loadTranscript: mockLoadTranscript,
        voice: mockVoice,
        enterCodingMode: mockEnterCodingMode,
        exitCodingMode: mockExitCodingMode,
        shareCode: mockShareCode,
        endInterview: mockEndInterview,
    }),
}));

vi.mock('@/hooks/useAssessment', () => ({
    useAssessment: () => ({
        analyzeSession: vi.fn(), isAnalyzing: false, result: null, reset: vi.fn(),
    }),
}));

vi.mock('@/hooks/useInterviewLimits', () => ({
    useInterviewLimits: () => ({
        incrementTurn: vi.fn(), startTimer: vi.fn(), stopTimer: vi.fn(),
        isTimeUp: false, isTurnsUp: false, timeRemaining: 1200,
        formattedElapsed: '00:00', shouldShowTurnWarning: false,
        turnsRemaining: 20, formattedTotal: '20:00', isHalfTime: false,
    }),
}));

vi.mock('@/hooks/useGuestSession', () => ({
    useGuestSession: () => ({
        recordUserTurn: vi.fn(), recordAITurn: vi.fn(),
        isTrialComplete: false, showLoginPrompt: false,
        userTurns: 0, aiTurns: 0, reset: vi.fn(),
    }),
    GUEST_SESSION_LIMITS: { MAX_USER_TURNS: 5 },
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => false,
}));

vi.mock('@/hooks/useSwipeNavigation', () => ({
    useSwipeNavigation: () => ({
        handlers: {},
        currentIndex: 1,
    }),
}));

// ─── ResizablePanelGroup mock (shows children) ───
vi.mock('@/components/ui/resizable', () => ({
    ResizablePanelGroup: ({ children, className }: any) => (
        <div data-testid="resizable-group" className={className}>{children}</div>
    ),
    ResizablePanel: ({ children }: any) => (
        <div data-testid="resizable-panel">{children}</div>
    ),
    ResizableHandle: () => <div data-testid="resizable-handle" />,
    useResizablePanelGroup: () => ({
        setPanelSize: vi.fn(),
    }),
}));

// ─── Supabase mock ───
vi.mock('@/lib/supabase/client', () => {
    const mock = {
        from: () => ({
            select: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                eq: () => ({
                    single: () => Promise.resolve({
                        data: { preferred_voice_name: 'test', voice_rate: 1, voice_pitch: 1 },
                        error: null
                    })
                })
            })
        }),
        auth: {
            getUser: () => Promise.resolve({ data: { user: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
    };
    return { createBrowserSupabase: () => mock, getSupabase: () => mock, isSupabaseConfigured: () => false };
});

vi.mock('@/lib/voice/interruption-manager', () => ({
    InterruptionManager: class {
        handleUserSpeechStart() { return 'WAIT'; }
        handleUserSpeechEnd() { }
        handleAIResponseStart() { }
        handleAIResponseComplete() { }
        cancelAISpeech() { }
        reset() { }
        removeAllListeners() { }
        on() { return () => { }; }
    },
}));

vi.mock('@/lib/interview/silent-observer', () => ({
    SilentObserver: class {
        analyze() { return Promise.resolve({}); }
        reset() { }
    },
}));

vi.mock('@/lib/analytics/voice-analytics', () => ({
    voiceAnalytics: { track: vi.fn() },
}));

vi.mock('@/app/actions/save-session', () => ({
    saveInterviewSession: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/utils/device-detection', () => ({
    isMobileDevice: vi.fn(() => false),
}));

vi.mock('sonner', () => ({
    toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

// ─── Mock all heavy child components ───
vi.mock('../CodeEditor', () => ({
    CodeEditor: ({ onCodeChange, runDisabled }: any) => {
        React.useEffect(() => {
            onCodeChange?.('print("hello")');
        }, [onCodeChange]);
        return <div data-testid="mock-code-editor" data-run-disabled={runDisabled ? 'true' : 'false'}>CodeEditor</div>;
    },
}));
vi.mock('../TestCasePanel', () => ({
    TestCasePanel: () => <div data-testid="mock-test-case-panel" />,
    buildKaiExecutionContext: vi.fn(() => 'ctx'),
    matchResults: vi.fn(() => []),
}));
vi.mock('../ConversationView', () => ({
    ConversationView: () => <div data-testid="mock-conversation-view">Conversation</div>,
}));
vi.mock('../VoiceOnboarding', () => ({ VoiceOnboarding: () => null }));
vi.mock('../GuestRegisterModal', () => ({ GuestRegisterModal: () => null }));
vi.mock('../SilentObserverNudge', () => ({ SilentObserverNudge: () => null }));
vi.mock('../TextInterviewMode', () => ({ TextInterviewMode: () => null }));
vi.mock('@/components/voice/MicrophoneButton', () => ({
    MicrophoneButton: () => <button data-testid="mock-mic-button" />,
}));
vi.mock('@/components/voice/MicPulse', () => ({
    MicPulse: () => <div data-testid="mock-mic-pulse" />,
}));
vi.mock('@/components/voice/ZoomTranscript', () => ({
    ZoomTranscript: () => <div data-testid="mock-transcript-viewer" />,
}));
vi.mock('@/components/assessment/SkillBadge', () => ({
    SkillBadge: () => null,
}));
vi.mock('@/components/ui/ErrorBanner', () => ({
    ErrorBanner: () => null,
}));

// ─── Import component under test ───
import { InterviewSession } from '../InterviewSession';

const mockProblem = {
    id: 'prob-1',
    title: 'Two Sum',
    description: 'Find two numbers that add up to target.',
    difficulty: 'easy' as const,
    examples: [{ input: '[2,7,11,15], target=9', output: '[0,1]' }],
    tags: [],
    hints: [],
};

const mockConfig: any = {
    difficultyMode: 'practice',
    maxDurationMs: 1200000,
    maxTurnsPerProblem: 20,
};

describe('InterviewSession 4-Quadrant Desktop Layout', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
        vi.clearAllMocks();
        mockInterviewState.state = 'idle';
        mockInterviewState.messages = [];
        mockInterviewState.isProcessing = false;
        mockInterviewState.roundCount = 0;
        mockInterviewState.interviewStartTime = null;
        mockInterviewState.isLimitReached = false;
        mockInterviewState.limitReason = null;
        mockInterviewState.micStoppedManually = false;
        mockInterviewState.sendCountdown = null;
        mockInterviewState.ttsError = false;
        mockInterviewState.isPushToTalk = false;
        mockVoice.isListening = false;
        mockVoice.isSpeaking = false;
        mockVoice.transcript = '';
        mockVoice.interimTranscript = '';
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Renders desktop resizable shell', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByTestId('resizable-group').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByTestId('resizable-panel').length).toBeGreaterThanOrEqual(4);
        expect(screen.getAllByTestId('resizable-handle').length).toBeGreaterThanOrEqual(3);
    });

    it('2. Shows LeetCode link and problem description in top-left context panel', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByRole('link', { name: /LeetCode/i }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Find two numbers that add up to target.')).toBeTruthy();
    });

    it('3. Keeps code editor mounted in desktop layout', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByTestId('mock-code-editor').length).toBeGreaterThanOrEqual(1);
    });

    it('4. Shows begin CTA before interview starts', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        const beginBtns = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        expect(beginBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('5. Shows desktop voice and submit controls after start', async () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        const beginButtons = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        await act(async () => {
            fireEvent.click(beginButtons[0]);
        });

        expect(screen.getAllByTestId('mock-mic-button').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('button', { name: /Submit to Kai/i }).length).toBeGreaterThanOrEqual(1);
    });

    it('6. Keeps mobile swipe tabs mounted', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getByRole('tablist', { name: /Interview mobile panels/i })).toBeTruthy();
    });

    it('7. Submit to Kai sends code-only payload', async () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);

        const beginButtons = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        await act(async () => {
            fireEvent.click(beginButtons[0]);
        });

        const submitButtons = screen.getAllByRole('button', { name: /Submit to Kai/i });
        await act(async () => {
            fireEvent.click(submitButtons[0]);
        });

        expect(mockSubmitUserResponse).toHaveBeenCalled();
        const payload = String(mockSubmitUserResponse.mock.calls[0][0]);
        expect(payload).toContain('[Submitted Code]');
        expect(payload).toContain('print("hello")');
        expect(payload).not.toContain('[Execution Result]');
        expect(payload).not.toContain('Code executed successfully');
        expect(payload).not.toContain('Code failed with exit code');
        expect(mockShareCode).toHaveBeenCalledWith('print("hello")');
    });

    it('8. Limit reached locks editor run and submit actions', async () => {
        mockInterviewState.isLimitReached = true;

        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);

        const beginButtons = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        await act(async () => {
            fireEvent.click(beginButtons[0]);
        });

        const submitButtons = screen.getAllByRole('button', { name: /Submit to Kai/i });
        expect((submitButtons[0] as HTMLButtonElement).disabled).toBe(true);

        const codeEditors = screen.getAllByTestId('mock-code-editor');
        expect(codeEditors[0].getAttribute('data-run-disabled')).toBe('true');
    });
});
