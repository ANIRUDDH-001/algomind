/**
 * @codesage
 * @file      src/components/interview/__tests__/IntegrityFlags.test.tsx
 * @purpose   Tests for integrity flags detection in InterviewSession.
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
/**
 * @vitest-environment jsdom
 */
import { render, act, waitFor, screen } from '@testing-library/react';
import { InterviewSession } from '../InterviewSession';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { InterviewConfig } from '@/lib/interview/interview-config';
import React from 'react';
import { useInterviewLimits } from '@/hooks/useInterviewLimits';



Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// --- Mocks ---
vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(() => ({ user: { id: 'test-user' } }))
}));

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ push: vi.fn() })),
    useSearchParams: vi.fn(() => new URLSearchParams())
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: vi.fn(() => false)
}));

vi.mock('@/hooks/useAssessment', () => ({
    useAssessment: vi.fn(() => ({
        analyzeSession: vi.fn(),
        isAnalyzing: false,
        result: null,
        reset: vi.fn()
    }))
}));

vi.mock('@/hooks/useInterviewLimits', () => ({
    useInterviewLimits: vi.fn(() => ({
        incrementTurn: vi.fn(),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        isTimeUp: false,
        turnsRemaining: 10,
        timeRemaining: 1000,
        formattedElapsed: '00:00'
    }))
}));

vi.mock('@/hooks/useGuestSession', () => ({
    useGuestSession: vi.fn(() => ({
        recordUserTurn: vi.fn(),
        recordAITurn: vi.fn(),
        isTrialComplete: false,
        showLoginPrompt: false,
        reset: vi.fn(),
        guestSession: { aiTurns: 0 }
    }))
}));

vi.mock('@/hooks/useSwipeNavigation', () => ({
    useSwipeNavigation: vi.fn(() => ({
        handlers: {},
        currentIndex: 0
    }))
}));

// Mock useInterview to return our test messages
let mockMessages: any[] = [];
let mockVoiceState = { isSpeaking: false, isListening: false, stopListening: vi.fn(), startListening: vi.fn() };
let mockEndInterview = vi.fn();

vi.mock('@/hooks/useInterview', () => ({
    useInterview: vi.fn(() => ({
        state: 'in_progress',
        messages: mockMessages,
        isProcessing: false,
        startInterview: vi.fn(),
        resetInterview: vi.fn(),
        submitUserResponse: vi.fn(),
        handleInterruption: vi.fn(),
        loadTranscript: vi.fn(),
        voice: mockVoiceState,
        endInterview: mockEndInterview,
        roundCount: 1,
        interviewStartTime: Date.now(),
        isLimitReached: false,
        limitReason: null,
        micStoppedManually: false,
        sendCountdown: 0,
        ttsError: null,
        isPushToTalk: false,
        enterCodingMode: vi.fn(),
        exitCodingMode: vi.fn(),
        shareCode: vi.fn()
    }))
}));

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null })
        }))
    }))
}));

vi.mock('../InterviewHeader', () => ({ InterviewHeader: () => <div data-testid="header" /> }));
vi.mock('../ConversationView', () => ({ ConversationView: () => <div data-testid="conversation" /> }));
vi.mock('../TestCasePanel', () => ({ TestCasePanel: () => <div data-testid="test-cases" /> }));
vi.mock('../InterviewTopBar', () => ({ InterviewTopBar: () => <div data-testid="topbar" /> }));
vi.mock('../ManualControls', () => ({ ManualControls: () => <div data-testid="controls" /> }));

vi.mock('react-resizable-panels', () => ({
    Group: ({ children }: any) => <div>{children}</div>,
    Panel: ({ children }: any) => <div>{children}</div>,
    Separator: () => <div />
}));

// Pass onChange to our dummy editor so we can inject code
let injectedSetCode: (c: string) => void;
vi.mock('../CodeEditor', () => ({
    CodeEditor: ({ onCodeChange }: { onCodeChange: (c: string) => void }) => {
        injectedSetCode = onCodeChange;
        return <div data-testid="editor" />;
    }
}));

const mockProblem = { id: 'p1', title: 'Test Problem', description: 'Test', difficulty: 'easy', tags: [], examples: [], constraints: '' };
const mockConfig = { mode: 'practice', difficultyMode: 'practice', ragContext: '' } as unknown as InterviewConfig;

describe('InterviewSession Integrity Flags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMessages = [];
        delete (window as any).__setCode;
    });

    it('detects fast_solution if session ends under 120 seconds', async () => {
        vi.mocked(useInterviewLimits).mockReturnValue({
            incrementTurn: vi.fn(),
            startTimer: vi.fn(),
            stopTimer: vi.fn(),
            isTimeUp: true,
            isTurnsUp: false,
            turnsRemaining: 0,
            timeRemaining: 0,
            formattedElapsed: '01:00'
        } as any);

        mockMessages = [
            { role: 'assistant', content: 'Hello' },
            { role: 'user', content: 'Here is a very long message with more than ten words to avoid the no verbal discussion flag.' }
        ];
        
        const onComplete = vi.fn();

        render(
            <InterviewSession
                problem={mockProblem as any}
                interviewConfig={mockConfig}
                isAssessment={true}
                onAssessmentComplete={onComplete}
                startTimeOffsetSeconds={0}
            />
        );

        act(() => {
            screen.getAllByTestId('begin-interview-btn')[0].click();
        });

        await waitFor(() => {
            expect(onComplete).toHaveBeenCalled();
        });

        const flags = onComplete.mock.calls[0][2];
        expect(flags).toContain('fast_solution');
        expect(flags).not.toContain('no_verbal_discussion');
    });

    it('detects no_verbal_discussion if code is written but no meaningful messages sent', async () => {
        let toggleTimeUp: () => void;
        vi.mocked(useInterviewLimits).mockImplementation(() => {
            const [isTimeUp, setTimeUp] = React.useState(false);
            toggleTimeUp = () => setTimeUp(true);
            return {
                incrementTurn: vi.fn(),
                startTimer: vi.fn(),
                stopTimer: vi.fn(),
                isTimeUp,
                isTurnsUp: false,
                turnsRemaining: 0,
                timeRemaining: 0,
                formattedElapsed: '05:00'
            } as any;
        });

        mockMessages = [
            { role: 'assistant', content: 'Hello' },
            { role: 'user', content: 'short message' }
        ];
        
        const onComplete = vi.fn();

        render(
            <InterviewSession
                problem={mockProblem as any}
                interviewConfig={mockConfig}
                isAssessment={true}
                onAssessmentComplete={onComplete}
                startTimeOffsetSeconds={200} // avoid fast_solution
            />
        );

        act(() => {
            screen.getAllByTestId('begin-interview-btn')[0].click();
        });

        // Inject long code (> 50 chars)
        act(() => {
            if (injectedSetCode) {
                injectedSetCode('function foo() { \n // This is a very long code snippet \n return true; \n }');
            }
        });

        // Trigger time limit to finish
        act(() => {
            toggleTimeUp();
        });

        await waitFor(() => {
            expect(onComplete).toHaveBeenCalled();
        });

        const flags = onComplete.mock.calls[0][2];
        expect(flags).toContain('no_verbal_discussion');
        expect(flags).not.toContain('fast_solution');
    });
});
