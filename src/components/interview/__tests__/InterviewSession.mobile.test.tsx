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

// ─── Mock hooks and modules ───
vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

const mockAuthUser = { id: 'test-user' };
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: () => ({ user: mockAuthUser }),
}));

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
        formattedElapsed: '00:00', shouldShowTurnWarning: false, turnsRemaining: 20, formattedTotal: '20:00'
    }),
}));

vi.mock('@/hooks/useGuestSession', () => ({
    useGuestSession: () => ({
        recordUserTurn: vi.fn(), recordAITurn: vi.fn(), isTrialComplete: false, showLoginPrompt: false, userTurns: 0, aiTurns: 0, reset: vi.fn(),
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

vi.mock('@/lib/supabase/client', () => {
    const mock = {
        from: () => ({
            select: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
                eq: () => ({
                    single: () => Promise.resolve({ data: { preferred_voice_name: 'test', voice_rate: 1, voice_pitch: 1 }, error: null })
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

vi.mock('@/lib/utils/device-detection', () => ({
    isMobileDevice: vi.fn(() => false),
}));

// ─── Mock components ───
vi.mock('../CodeEditor', () => ({
    CodeEditor: () => <div data-testid="mock-code-editor">CodeEditor</div>,
}));
vi.mock('../ConversationView', () => ({
    ConversationView: () => <div data-testid="mock-conversation-view">ConversationView</div>,
}));
vi.mock('../InterviewTopBar', () => ({
    InterviewTopBar: () => <div data-testid="mock-top-bar">TopBar</div>,
}));
vi.mock('../VoiceOnboarding', () => ({ VoiceOnboarding: () => null }));
vi.mock('../GuestRegisterModal', () => ({ GuestRegisterModal: () => null }));
vi.mock('../SilentObserverNudge', () => ({ SilentObserverNudge: () => null }));
vi.mock('@/components/voice/MicrophoneButton', () => ({
    MicrophoneButton: () => <button data-testid="mock-mic-button">Mic</button>,
}));
vi.mock('@/components/voice/MicPulse', () => ({
    MicPulse: () => <div>Pulse</div>,
}));
vi.mock('@/components/voice/ZoomTranscript', () => ({
    ZoomTranscript: () => <div>Transcript</div>,
}));

// ─── Import component under test ───
import { InterviewSession } from '../InterviewSession';
import * as deviceDetection from '@/lib/utils/device-detection';

const mockProblem = {
    id: 'prob-1',
    title: 'Two Sum',
    description: 'Find two numbers that add up to target.',
    difficulty: 'easy' as const,
    examples: [],
    tags: [],
    hints: [],
};

describe('InterviewSession Mobile Regression', () => {
    const mockConfig: any = {
        difficultyMode: 'practice',
        maxDurationMs: 1200000,
        maxTurnsPerProblem: 20,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('Mobile: Code tab renders code editor', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
        vi.mocked(deviceDetection.isMobileDevice).mockReturnValue(true);

        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);

        // Click mobile Code tab
        const codeTabs = screen.getAllByRole('tab', { name: /Code tab/i });
        expect(codeTabs.length).toBeGreaterThan(0);

        await act(async () => {
            fireEvent.click(codeTabs[codeTabs.length - 1]);
        });

        // After switching to code tab, code editor should be rendered
        const codeEditorsAfter = await screen.findAllByTestId('mock-code-editor');
        expect(codeEditorsAfter.length).toBeGreaterThanOrEqual(1);
    });

    it('Mobile: Voice tab renders pre-start interview CTA', async () => {
        Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 390 });
        vi.mocked(deviceDetection.isMobileDevice).mockReturnValue(true);

        render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig} />);

        // Pre-start state should show begin CTA
        const beginBtns = screen.getAllByRole('button', { name: /Begin Interview Experience/i });
        expect(beginBtns.length).toBeGreaterThanOrEqual(1);

        // Current tab label is "Voice"
        const voiceTabs = screen.getAllByRole('tab', { name: /Voice tab/i });
        expect(voiceTabs.length).toBeGreaterThan(0);
    });
});
