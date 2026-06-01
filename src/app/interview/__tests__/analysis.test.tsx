/**
 * @codesage
 * @file      src/app/interview/__tests__/analysis.test.tsx
 * @purpose   Tests for AnalysisClient and AnalysisPage server component.
 * @tech      Vitest, React Testing Library, React
 * @connects  AnalysisClient, AnalysisPage, supabase/server, feature-flags-server, spaced-repetition
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AnalysisClient } from '@/components/analysis/AnalysisClient';
import AnalysisPage from '../analysis/page';
import * as serverSupabase from '@/lib/supabase/server';
import * as featureFlags from '@/lib/feature-flags-server';
import { redirect } from 'next/navigation';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '',
    redirect: vi.fn().mockImplementation((url) => { throw new Error('NEXT_REDIRECT'); }),
}));

// Mock API functions for the Server Component
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/feature-flags-server', () => ({
    getGlobalFeatureFlag: vi.fn(),
}));

vi.mock('@/app/actions/spaced-repetition', () => ({
    getSpacedReviewForProblem: vi.fn(),
}));

// Helper to assert elements
const mockSession = {
    id: 'session-123',
    problemId: 'two-sum',
    problemTitle: 'Two Sum',
    problemDifficulty: 'easy' as const,
    transcript: [
        { speaker: 'interviewer', text: 'Hello', timestamp: 0 },
        { speaker: 'candidate', text: 'Hi', timestamp: 2 },
    ],
    duration: 600,
    overallScore: 8.5,
    completedAt: '2026-02-25T12:00:00Z',
};

const mockAssessment = {
    overallScore: 8.5,
    skills: {
        'problem-decomposition': 8,
        'pattern-recognition': 7,
        'algorithmic-thinking': 9,
        'complexity-analysis': 6,
        'communication-clarity': 8,
        'edge-case-awareness': 9,
        'optimization-mindset': 7,
        'debugging-approach': 8,
    },
    overallFeedback: 'Great job overall. You focused well on edge cases. Consider practicing complexity analysis more.',
    nextSteps: ['Review Big-O notation', 'Practice dynamic programming'],
    skillEvidence: {
        'edge-case-awareness': { timestamp: 300, moment: 'Handled empty array' }
    }
};

describe('AnalysisClient Component', () => {
    afterEach(() => {
        cleanup();
    });

    it('should render score and all 8 skills correctly', () => {
        render(
            <AnalysisClient
                session={mockSession}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={[]}
                flags={{ enableComparative: false, enableLearnMode: false }}
            />
        );

        // Check text content - ignore the exact AnimatedScore number since Framer Motion hasn't ticked in JSDOM
        expect(screen.getByText('Two Sum')).toBeInTheDocument();
        expect(screen.getByText('easy')).toBeInTheDocument();

        // Check if all 8 skills are rendered (using skill names defined in registry)
        expect(screen.getByText('Problem Decomposition')).toBeInTheDocument();
        expect(screen.getByText('Pattern Recognition')).toBeInTheDocument();
        expect(screen.getByText('Algorithmic Thinking')).toBeInTheDocument();
        expect(screen.getByText('Complexity Analysis')).toBeInTheDocument();
        expect(screen.getByText('Communication Clarity')).toBeInTheDocument();
        expect(screen.getByText('Edge Case Awareness')).toBeInTheDocument();
        expect(screen.getByText('Optimization Mindset')).toBeInTheDocument();
        expect(screen.getByText('Debugging Approach')).toBeInTheDocument();
    });

    it('should render empty transcript state when transcript is missing', () => {
        render(
            <AnalysisClient
                session={{ ...mockSession, transcript: [] }}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={[]}
                flags={{ enableComparative: false, enableLearnMode: false }}
            />
        );

        expect(screen.getByTestId('no-transcript')).toHaveTextContent('Voice data not available');
    });

    it('should gate Learn button behind enableLearnMode flag', () => {
        const { rerender } = render(
            <AnalysisClient
                session={mockSession}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={[]}
                flags={{ enableComparative: false, enableLearnMode: true }}
            />
        );

        expect(screen.getByTestId('learn-button')).toBeInTheDocument();

        rerender(
            <AnalysisClient
                session={mockSession}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={[]}
                flags={{ enableComparative: false, enableLearnMode: false }}
            />
        );

        expect(screen.queryByTestId('learn-button')).not.toBeInTheDocument();
    });

    it('should gate Comparative Preview behind enableComparative flag and existing attempts', () => {
        const previousAttempts = [
            { id: 'prev-1', score: 6.0, completedAt: '2026-02-20T12:00:00Z', duration: 500 }
        ];

        const { rerender } = render(
            <AnalysisClient
                session={mockSession}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={previousAttempts}
                flags={{ enableComparative: true, enableLearnMode: false }}
            />
        );

        expect(screen.getByTestId('comparison-preview')).toBeInTheDocument();

        rerender(
            <AnalysisClient
                session={mockSession}
                assessment={mockAssessment}
                reviewData={null}
                previousAttempts={previousAttempts}
                flags={{ enableComparative: false, enableLearnMode: false }}
            />
        );

        expect(screen.queryByTestId('comparison-preview')).not.toBeInTheDocument();
    });
});

describe('AnalysisPage Server Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Helper to mock Supabase chain
    function mockSupabaseResponse(data: any) {
        const maybeSingleMock = vi.fn().mockResolvedValue({ data });
        const singleMock = vi.fn().mockResolvedValue({ data });
        const limitMock = vi.fn().mockResolvedValue({ data });
        const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
        const neqMock = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: orderMock }) });
        const eqMock2 = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ neq: neqMock }), single: singleMock });
        const eqMock = vi.fn().mockReturnValue({ eq: eqMock2, maybeSingle: maybeSingleMock, single: singleMock });
        const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
        const fromMock = vi.fn().mockReturnValue({ select: selectMock });

        return {
            from: fromMock,
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }) }
        };
    }

    it('should redirect unauthorized users to /login', async () => {
        (serverSupabase.createServerSupabase as any).mockResolvedValue({
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }
        });

        // redirect actually throws in Next.js, and our mock throws NEXT_REDIRECT
        await expect(AnalysisPage({ searchParams: Promise.resolve({ sessionId: '123' }) })).rejects.toThrow('NEXT_REDIRECT');
        expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('should redirect to /dashboard if session is not found', async () => {
        const mockSupabase = mockSupabaseResponse(null);
        (serverSupabase.createServerSupabase as any).mockResolvedValue(mockSupabase);

        await expect(AnalysisPage({ searchParams: Promise.resolve({ sessionId: 'missing' }) })).rejects.toThrow('NEXT_REDIRECT');
        expect(redirect).toHaveBeenCalledWith('/dashboard');
    });
});
