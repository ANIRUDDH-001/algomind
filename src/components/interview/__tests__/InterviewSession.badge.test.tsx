// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { InterviewSession } from '../InterviewSession';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterview } from '@/hooks/useInterview';
import { useGuestSession } from '@/hooks/useGuestSession';
import * as turnClassifier from '@/lib/interview/turn-classifier';
import React from 'react';

// Mock dependencies
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

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn()
}));

vi.mock('@/hooks/useInterview', () => ({
    useInterview: vi.fn()
}));

vi.mock('@/hooks/useGuestSession', () => ({
    useGuestSession: vi.fn(),
    GUEST_SESSION_LIMITS: { MAX_USER_TURNS: 5 }
}));

vi.mock('@/hooks/useAssessment', () => ({
    useAssessment: () => ({
        analyzeSession: vi.fn(),
        isAnalyzing: false,
        result: null,
        reset: vi.fn()
    })
}));

vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: () => false
}));

vi.mock('@/hooks/useInterviewLimits', () => ({
    useInterviewLimits: () => ({
        incrementTurn: vi.fn(),
        startTimer: vi.fn(),
        stopTimer: vi.fn(),
        isTimeUp: false,
        isTurnsUp: false,
        shouldShowTurnWarning: false,
        turnsRemaining: 10,
        timeRemaining: 600,
        formattedElapsed: '00:00'
    })
}));

vi.mock('@/hooks/useSwipeNavigation', () => ({
    useSwipeNavigation: () => ({
        handlers: {},
        currentIndex: 0
    })
}));

vi.mock('@/components/voice/MicrophoneButton', () => ({
    MicrophoneButton: ({ onClick }: any) => <button data-testid="mic-btn" onClick={onClick}>Mic</button>
}));
vi.mock('@/components/voice/MicPulse', () => ({
    MicPulse: () => <div>Pulse</div>
}));
vi.mock('@/components/voice/TranscriptViewer', () => ({
    TranscriptViewer: () => <div>Transcript</div>
}));

const mockProblem = {
    id: 'test-prob',
    title: 'Two Sum',
    description: 'Find two numbers',
    difficulty: 'easy'
};

const mockConfig = {
    problem: mockProblem,
    difficulty: 'easy',
    maxDurationMs: 600000
};

describe('SkillBadge integration in InterviewSession', () => {
    let mockStartInterview: any;
    let mockHandleUserMessage: any;

    beforeEach(() => {
        vi.clearAllMocks();

        (useAuth as any).mockReturnValue({ user: { id: 'user1' } });

        mockStartInterview = vi.fn();

        (useInterview as any).mockImplementation(({ onUserMessage }: any) => {
            mockHandleUserMessage = onUserMessage;
            return {
                state: 'idle',
                messages: [],
                isProcessing: false,
                startInterview: mockStartInterview,
                resetInterview: vi.fn(),
                submitUserResponse: vi.fn(),
                handleInterruption: vi.fn(),
                loadTranscript: vi.fn(),
                voice: { isSpeaking: false, isListening: false, stopListening: vi.fn() },
                endInterview: vi.fn(),
                roundCount: 0,
                interviewStartTime: Date.now(),
                isLimitReached: false,
            };
        });

        (useGuestSession as any).mockReturnValue({
            recordUserTurn: vi.fn(),
            recordAITurn: vi.fn(),
            isTrialComplete: false,
            showLoginPrompt: false,
            userTurns: 0,
            aiTurns: 0,
            reset: vi.fn()
        });

        vi.spyOn(turnClassifier, 'classifyTurnSignal').mockResolvedValue(null);
    });

    it('does NOT fire badge on message 3 by count', async () => {
        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig as any} />);

        await act(async () => {
            const startBtn = container.querySelector('[data-tour="begin-button"]') as HTMLButtonElement;
            startBtn.click();
        });

        // Trigger user messages
        await act(async () => {
            mockHandleUserMessage({ role: 'user', content: 'hello' }, 1);
            mockHandleUserMessage({ role: 'user', content: 'test 12345678901234567890' }, 2);
            mockHandleUserMessage({ role: 'user', content: 'test 12345678901234567890' }, 3);
        });

        // Because classifyTurnSignal returns null, badge shouldn't show
        const badge = screen.queryByText(/insight detected/i) || screen.queryByText(/signal/i);
        expect(badge).toBeNull();
    });

    it('fires badge when classifyTurnSignal returns high-confidence signal', async () => {
        vi.spyOn(turnClassifier, 'classifyTurnSignal').mockResolvedValue({
            dimension: 'pattern-recognition',
            confidence: 0.9,
            triggerPhrase: 'Correctly chose Hash Map'
        });

        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig as any} />);

        await act(async () => {
            const startBtn = container.querySelector('[data-tour="begin-button"]') as HTMLButtonElement;
            startBtn.click();
        });

        await act(async () => {
            mockHandleUserMessage({ role: 'user', content: 'I will use a hash map for O(1) lookups which is fast enough.' }, 1);
        });

        await waitFor(() => {
            expect(screen.getByText('Correctly chose Hash Map')).toBeTruthy();
        });
    });

    it('does not fire same dimension badge twice per session', async () => {
        let calls = 0;
        vi.spyOn(turnClassifier, 'classifyTurnSignal').mockImplementation(async () => {
            calls++;
            return {
                dimension: 'algorithmic-thinking',
                confidence: 0.9,
                triggerPhrase: `Dynamic trigger ${calls}`
            };
        });

        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig as any} />);

        await act(async () => {
            const startBtn = container.querySelector('[data-tour="begin-button"]') as HTMLButtonElement;
            startBtn.click();
        });

        await act(async () => {
            mockHandleUserMessage({ role: 'user', content: 'I will write a loop. 1234567890123' }, 1);
        });

        await waitFor(() => {
            expect(screen.getByText('Dynamic trigger 1')).toBeTruthy();
        });

        await act(async () => {
            mockHandleUserMessage({ role: 'user', content: 'Another complex loop statement. 1234' }, 2);
        });

        // It shouldn't show "Dynamic trigger 2" because it's the same dimension, but mock clears badge after timeout normally
        // Actually, we prevented standard double-fire inside usecallback.
        await waitFor(() => {
            const found = screen.queryByText('Dynamic trigger 2');
            expect(found).toBeNull();
        });
    });

    it('badge does not fire for guest mode sessions', async () => {
        vi.spyOn(turnClassifier, 'classifyTurnSignal').mockResolvedValue({
            dimension: 'pattern-recognition',
            confidence: 0.9,
            triggerPhrase: 'Should not fire'
        });

        const { container } = render(<InterviewSession problem={mockProblem as any} interviewConfig={mockConfig as any} isGuest={true} />);

        await act(async () => {
            const startBtn = container.querySelector('[data-tour="begin-button"]') as HTMLButtonElement;
            startBtn.click();
        });

        await act(async () => {
            mockHandleUserMessage({ role: 'user', content: 'A long string to bypass length check 1234567890' }, 1);
        });

        // Because isGuest, classifyTurnSignal shouldn't be called, so badge won't show
        await waitFor(() => {
            expect(turnClassifier.classifyTurnSignal).not.toHaveBeenCalled();
            expect(screen.queryByText('Should not fire')).toBeNull();
        });
    });
});
