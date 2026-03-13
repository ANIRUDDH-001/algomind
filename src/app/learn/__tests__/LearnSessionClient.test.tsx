/** @vitest-environment jsdom */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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

vi.mock('next/navigation', () => ({
    useRouter: vi.fn().mockReturnValue({ push: vi.fn() })
}));

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn().mockReturnValue({ user: { id: 'user-123' } })
}));

vi.mock('@/hooks/useInterview', () => ({
    useInterview: vi.fn().mockReturnValue({
        messages: [],
        isProcessing: false,
        voice: {
            isSpeaking: false,
            isListening: false,
            speak: vi.fn(),
            stopSpeaking: vi.fn(),
            startListening: vi.fn(),
            stopListening: vi.fn()
        },
        submitUserResponse: vi.fn(),
        loadTranscript: vi.fn(),
        handleInterruption: vi.fn(),
        startInterview: vi.fn(),
    })
}));

// Mock CodeEditor
vi.mock('@/components/interview/CodeEditor', () => ({
    CodeEditor: ({ onCodeChange, readOnly }: any) => (
        <div data-testid="code-editor" data-readonly={readOnly ?? false}>
            <button onClick={() => onCodeChange?.('new code')}>Change Code</button>
        </div>
    )
}));

vi.mock('@/components/interview/ConversationView', () => ({
    ConversationView: () => <div data-testid="conversation-view">Conversations</div>,
}));

vi.mock('@/components/voice/MicrophoneButton', () => ({
    MicrophoneButton: ({ onClick, disabled }: any) => (
        <button data-testid="mic-btn" onClick={onClick} disabled={disabled}>Mic</button>
    ),
}));

vi.mock('@/components/voice/MicPulse', () => ({
    MicPulse: () => <div data-testid="mic-pulse" />,
}));

vi.mock('@/components/interview/TestCasePanel', () => ({
    TestCasePanel: () => <div data-testid="test-case-panel">Test Cases</div>,
}));

vi.mock('@/app/actions/learn', () => ({
    recordLearnSession: vi.fn().mockResolvedValue(undefined),
}));

import { LearnSessionClient } from '../LearnSessionClient';

const mockProblem = {
    id: 'prob-1',
    title: 'Two Sum',
    difficulty: 'easy',
    description: 'Find two numbers that sum to target',
    tags: ['array', 'hash-table'],
    examples: [
        { input: '[2,7,11,15], 9', output: '[0,1]' }
    ]
};

describe('LearnSessionClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it('renders CodeEditor', () => {
        render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        const editor = screen.getByTestId('code-editor');
        expect(editor).toBeDefined();
        // Since no readOnly prop is passed, our mock defaults it to false
        expect(editor.getAttribute('data-readonly')).toBe('false');
    });

    it('renders TestCasePanel when problem has examples', () => {
        render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        const panels = screen.getAllByTestId('test-case-panel');
        expect(panels.length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT render TestCasePanel when problem has no examples', () => {
        const problemNoExamples = { ...mockProblem, examples: [] };
        render(<LearnSessionClient problem={problemNoExamples as any} sessionCount={0} />);
        // The mock renders "Test Cases" text if it mounts
        expect(screen.queryByText('Test Cases')).toBeNull();
    });

    it('renders "Share Code with Kai" button', async () => {
        const { container } = render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        
        // Wait for asynchronous renders (like initial load delays) to finish
        await waitFor(() => {
            const allButtons = screen.getAllByRole('button');
            const shareBtn = allButtons.find(b => b.textContent?.includes('Share Code with Kai'));
            expect(shareBtn).toBeDefined();
        }, { timeout: 2000 });
    });
});
