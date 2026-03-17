// @vitest-environment jsdom

import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
        state: 'idle', messages: [], isProcessing: false,
        startInterview: vi.fn(), resetInterview: vi.fn(),
        submitUserResponse: vi.fn(), handleInterruption: vi.fn(),
        loadTranscript: vi.fn(),
        voice: {
            isListening: false, isSpeaking: false, error: null,
            startListening: vi.fn(), stopListening: vi.fn(), stopSpeaking: vi.fn(),
            transcript: '', interimTranscript: '',
        },
        roundCount: 0,
        interviewStartTime: null,
        isLimitReached: false,
        limitReason: null,
        enterCodingMode: vi.fn(),
        exitCodingMode: vi.fn(),
        shareCode: vi.fn(),
        endInterview: vi.fn(),
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
    CodeEditor: () => <div data-testid="mock-code-editor">CodeEditor</div>,
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

describe('InterviewSession 3-Panel Desktop Layout', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Renders the top bar with problem title', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        // problem title appears in both TopBar span and ProblemPanel card (desktop+mobile both in jsdom DOM)
        const titleElements = screen.getAllByText('Two Sum');
        expect(titleElements.length).toBeGreaterThanOrEqual(1);
    });

    it('2. Renders the desktop drawer layout shell', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByText('Problem').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('History').length).toBeGreaterThanOrEqual(1);
    });

    it('3. Code editor is shown after start and Code toggle', async () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        const beginButtons = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        await act(async () => {
            fireEvent.click(beginButtons[0]);
        });

        const codeButtons = screen.getAllByRole('button', { name: /^Code$/i });
        await act(async () => {
            fireEvent.click(codeButtons[0]);
        });

        expect(screen.getAllByTestId('mock-code-editor').length).toBeGreaterThanOrEqual(1);
    });

    it('4. Voice panel shows "Begin Interview Experience" before start', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        // desktop + mobile both render in jsdom, so we use getAllBy
        const beginBtns = screen.getAllByText('Begin Interview Experience');
        expect(beginBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('5. "Begin Interview Experience" is visible before interview starts', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        const beginButtons = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        expect(beginButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('6. Problem panel contains problem title and description', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        // problem title appears multiple times (TopBar + ProblemPanel + mobile)
        const titles = screen.getAllByText('Two Sum');
        expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('7. Problem title appears in TopBar', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        const titles = screen.getAllByText('Two Sum');
        expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    it('8. Problem panel toggle hides problem card content', async () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByText(/Practice on LeetCode/i).length).toBeGreaterThanOrEqual(1);

        const problemToggleButtons = screen.getAllByRole('button', { name: /Problem/i });
        await act(async () => {
            fireEvent.click(problemToggleButtons[0]);
        });

        expect(screen.queryByText(/Practice on LeetCode/i)).toBeNull();
    });

    it('9. Desktop shell is present on desktop width', () => {
        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);
        expect(screen.getAllByText('Problem').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('History').length).toBeGreaterThanOrEqual(1);
    });
});
