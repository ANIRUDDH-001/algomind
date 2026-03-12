/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { LearnSessionClient } from '../LearnSessionClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { useInterview } from '@/hooks/useInterview';

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
        voice: { isSpeaking: false, isListening: false, speak: vi.fn(), stopSpeaking: vi.fn(), startListening: vi.fn(), stopListening: vi.fn() },
        submitUserResponse: vi.fn(),
        loadTranscript: vi.fn(),
        handleInterruption: vi.fn(),
        startInterview: vi.fn(),
    })
}));

// Mock CodeEditor since it might use Monaco which is hard to test in JSDOM
vi.mock('@/components/interview/CodeEditor', () => ({
    CodeEditor: ({ onCodeChange, readOnly }: any) => (
        <div data-testid="code-editor" data-readonly={readOnly}>
            <button onClick={() => onCodeChange('new code')}>Change Code</button>
            <button role="button">Run</button>
        </div>
    )
}));

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

    it('renders CodeEditor in interactive (non-readOnly) mode', () => {
        render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        const editor = screen.getByTestId('code-editor');
        expect(editor.getAttribute('data-readonly')).toBe('false');
        expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
    });

    it('renders TestCasePanel when problem has examples', () => {
        render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        expect(screen.getByText('Test Cases')).toBeInTheDocument();
    });

    it('does NOT render TestCasePanel when problem has no examples', () => {
        const problemNoExamples = { ...mockProblem, examples: [] };
        render(<LearnSessionClient problem={problemNoExamples as any} sessionCount={0} />);
        expect(screen.queryByText('Test Cases')).not.toBeInTheDocument();
    });

    it('renders "Share with Kai" button', () => {
        render(<LearnSessionClient problem={mockProblem as any} sessionCount={0} />);
        expect(screen.getByText('Share Code with Kai')).toBeInTheDocument();
    });
});
