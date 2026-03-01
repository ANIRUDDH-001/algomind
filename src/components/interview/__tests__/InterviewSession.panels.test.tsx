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

// ─── Mock framer-motion (no animations, AnimatePresence is transparent) ───
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
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: { id: 'test-user' } }),
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
        formattedElapsed: '00:00', shouldShowTurnWarning: false, turnsRemaining: 20,
    }),
}));

vi.mock('@/hooks/useGuestTrial', () => ({
    useGuestTrial: () => ({
        recordTurn: vi.fn(), isTrialComplete: false, reset: vi.fn(), turnsUsed: 0,
    }),
    GUEST_TRIAL_LIMITS: { MAX_TURNS: 5 },
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => false,
}));

vi.mock('@/hooks/useSwipeNavigation', () => ({
    useSwipeNavigation: () => ({
        handlers: {
            onPointerDown: vi.fn(),
            onPointerMove: vi.fn(),
            onPointerUp: vi.fn(),
            onPointerCancel: vi.fn(),
        },
        currentIndex: 1,
        totalTabs: 4,
        dragOffset: 0,
    }),
}));

vi.mock('@/lib/supabase/client', () => {
    const mock = {
        from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
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
        analyze() { return Promise.resolve(null); }
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

vi.mock('@/lib/rate-limit/user-rate-limiter', () => ({
    RATE_LIMIT: { DAILY_LIMIT: 10 },
}));

// ─── Mock all heavy child components ───
vi.mock('../CodeEditor', () => ({
    CodeEditor: () => <div data-testid="mock-code-editor">Mock Code Editor</div>,
}));
vi.mock('../CompanyModeSelector', () => ({
    CompanyModeSelector: () => <div data-testid="mock-company-selector">Company Mode</div>,
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
vi.mock('@/components/voice/TranscriptViewer', () => ({
    TranscriptViewer: () => <div data-testid="mock-transcript-viewer" />,
}));
vi.mock('@/components/assessment/AssessmentLoader', () => ({
    AssessmentLoader: () => <div data-testid="mock-assessment-loader" />,
}));
vi.mock('@/components/assessment/ReportCard', () => ({
    ReportCard: () => <div data-testid="mock-report-card" />,
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
    examples: [],
    tags: [],
    hints: [],
};

// Helper: finds the main content area between the two panels
function getMainContent(container: HTMLElement) {
    // The main content div is the flex-1 div inside the desktop layout
    // It has transition-all duration-300 and has inline marginLeft/marginRight
    const desktopLayout = container.querySelector('.hidden.lg\\:flex, [class*="hidden lg:flex"]');
    if (!desktopLayout) return null;
    // main content area is the flex-1 child that has transition-all
    return desktopLayout.querySelector('.flex-1.flex.flex-col.min-h-0.transition-all');
}

// Helper: find drawer close button (×) by its parent panel
function getProblemDrawerCloseButton(container: HTMLElement) {
    // The problem panel header contains "Problem" text and a × button
    const panels = Array.from(container.querySelectorAll('.absolute.left-0.top-0.bottom-0'));
    for (const panel of panels) {
        const closeBtn = Array.from(panel.querySelectorAll('button')).find(b => b.textContent?.trim() === '×');
        if (closeBtn) return closeBtn;
    }
    return null;
}

function getHistoryDrawerCloseButton(container: HTMLElement) {
    const panels = Array.from(container.querySelectorAll('.absolute.right-0.top-0.bottom-0'));
    for (const panel of panels) {
        const closeBtn = Array.from(panel.querySelectorAll('button')).find(b => b.textContent?.trim() === '×');
        if (closeBtn) return closeBtn;
    }
    return null;
}

describe('InterviewSession Desktop Panel Behavior', () => {
    beforeEach(() => {
        // Desktop viewport
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 });
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Problem panel is visible by default (showProblemPanel=true initial state)', () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);
        // The problem panel is an absolute left-side drawer. "Problem" text appears in its header.
        const problemHeader = screen.getAllByText('Problem');
        expect(problemHeader.length).toBeGreaterThan(0);

        // The panel element with absolute left-0 positioning is in the DOM
        const problemPanel = container.querySelector('.absolute.left-0.top-0.bottom-0');
        expect(problemPanel).not.toBeNull();
    });

    it('2. History panel is hidden by default (showHistoryPanel=false initial state)', () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);
        // No absolute right-0 panel should exist
        const historyPanel = container.querySelector('.absolute.right-0.top-0.bottom-0');
        expect(historyPanel).toBeNull();
    });

    it('3. Clicking Problem toggle button closes the problem panel', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        // The toggle button is a motion.button with text "Problem" in the floating sidebar
        // It's inside `.absolute.left-2.top-1/2` or similar
        const togglebtns = Array.from(container.querySelectorAll('button')).filter(b =>
            b.textContent?.includes('Problem') && b.getAttribute('class')?.includes('rounded-xl')
        );
        expect(togglebtns.length).toBeGreaterThan(0);

        await act(async () => {
            fireEvent.click(togglebtns[0]);
        });

        // Problem panel should now be gone
        const problemPanel = container.querySelector('.absolute.left-0.top-0.bottom-0');
        expect(problemPanel).toBeNull();
    });

    it('4. Clicking Problem toggle button again re-opens panel', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        const getToggle = () => Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('Problem') && b.getAttribute('class')?.includes('rounded-xl')
        )!;

        // Close then re-open
        await act(async () => { fireEvent.click(getToggle()); });
        expect(container.querySelector('.absolute.left-0.top-0.bottom-0')).toBeNull();

        await act(async () => { fireEvent.click(getToggle()); });
        expect(container.querySelector('.absolute.left-0.top-0.bottom-0')).not.toBeNull();
    });

    it('5. Clicking History toggle button opens history panel', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        // History toggle button
        const historyToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('History') && b.getAttribute('class')?.includes('rounded-xl')
        )!;
        expect(historyToggle).toBeDefined();

        await act(async () => { fireEvent.click(historyToggle); });

        // History panel (.absolute.right-0) should now be visible
        const historyPanel = container.querySelector('.absolute.right-0.top-0.bottom-0');
        expect(historyPanel).not.toBeNull();
    });

    it('6. When problem panel is open: main content has marginLeft style containing 380px', () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);
        const mainContent = getMainContent(container);
        expect(mainContent).not.toBeNull();
        expect((mainContent as HTMLElement).style.marginLeft).toBe('380px');
    });

    it('7. When history panel is open: main content has marginRight style containing 340px', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        const historyToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('History') && b.getAttribute('class')?.includes('rounded-xl')
        )!;
        await act(async () => { fireEvent.click(historyToggle); });

        const mainContent = getMainContent(container);
        expect(mainContent).not.toBeNull();
        expect((mainContent as HTMLElement).style.marginRight).toBe('340px');
    });

    it('8. Both panels can be open simultaneously', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        const historyToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('History') && b.getAttribute('class')?.includes('rounded-xl')
        )!;
        await act(async () => { fireEvent.click(historyToggle); });

        // Both panels in DOM
        expect(container.querySelector('.absolute.left-0.top-0.bottom-0')).not.toBeNull();
        expect(container.querySelector('.absolute.right-0.top-0.bottom-0')).not.toBeNull();

        // Main content squeezed from both sides
        const mainContent = getMainContent(container)!;
        expect((mainContent as HTMLElement).style.marginLeft).toBe('380px');
        expect((mainContent as HTMLElement).style.marginRight).toBe('340px');
    });

    it('9. Close button (×) inside problem panel hides the panel', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);
        const closeBtn = getProblemDrawerCloseButton(container);
        expect(closeBtn).not.toBeNull();

        await act(async () => { fireEvent.click(closeBtn!); });
        expect(container.querySelector('.absolute.left-0.top-0.bottom-0')).toBeNull();
    });

    it('10. Close button (×) inside history panel hides the panel', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        // First open history panel
        const historyToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('History') && b.getAttribute('class')?.includes('rounded-xl')
        )!;
        await act(async () => { fireEvent.click(historyToggle); });
        expect(container.querySelector('.absolute.right-0.top-0.bottom-0')).not.toBeNull();

        const closeBtn = getHistoryDrawerCloseButton(container);
        expect(closeBtn).not.toBeNull();

        await act(async () => { fireEvent.click(closeBtn!); });
        expect(container.querySelector('.absolute.right-0.top-0.bottom-0')).toBeNull();
    });

    it('11. Panel toggle buttons are accessible (keyboard focusable, have visible text labels)', () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={{ difficultyMode: 'practice' } as any} />);

        const problemToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('Problem') && b.getAttribute('class')?.includes('rounded-xl')
        );
        const historyToggle = Array.from(container.querySelectorAll('button')).find(b =>
            b.textContent?.includes('History') && b.getAttribute('class')?.includes('rounded-xl')
        );

        // Both buttons exist and are not aria-disabled
        expect(problemToggle).toBeDefined();
        expect(historyToggle).toBeDefined();

        // They are focusable (no tabIndex=-1 or disabled)
        expect(problemToggle?.getAttribute('disabled')).toBeNull();
        expect(historyToggle?.getAttribute('disabled')).toBeNull();

        // Both have visible text labels
        expect(problemToggle?.textContent).toContain('Problem');
        expect(historyToggle?.textContent).toContain('History');
    });
});
