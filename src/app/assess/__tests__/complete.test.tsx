/**
 * @codesage
 * @file      src/app/assess/__tests__/complete.test.tsx
 * @purpose   Tests for assessment complete page content
 * @tech      Vitest, React Testing Library
 * @connects  ../complete/content
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1 | @skip: test-file
 */
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AssessmentCompleteContent } from '../complete/content';

// Mock next/navigation
const mockSearchParams = new Map<string, string>();
const mockSearchParamsObject = {
    get: (key: string) => mockSearchParams.get(key) || null,
};

vi.mock('next/navigation', () => ({
    useSearchParams: () => mockSearchParamsObject,
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => React.createElement('button', props, children),
}));

vi.mock('@/components/ui/card', () => ({
    Card: ({ children, ...props }: any) => React.createElement('div', props, children),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Check: () => React.createElement('span', null, '✓'),
    Sparkles: () => React.createElement('span', null, '✨'),
    ArrowRight: () => React.createElement('span', null, '→'),
    TrendingUp: () => React.createElement('span', null, '↑'),
    TrendingDown: () => React.createElement('span', null, '↓'),
    BookOpen: () => React.createElement('span', null, '📖'),
}));

// Mock skill definitions
vi.mock('@/lib/assessment/skill-registry', () => ({
    SKILL_DEFINITIONS: {
        'problem-decomposition': { name: 'Problem Decomposition', description: 'Breaking problems into components. Can be practiced daily.', color: '#6366f1', weight: 0.15, subCriteria: [] },
        'pattern-recognition': { name: 'Pattern Recognition', description: 'Identifying patterns. Key for algorithm design.', color: '#8b5cf6', weight: 0.15, subCriteria: [] },
        'algorithmic-thinking': { name: 'Algorithmic Thinking', description: 'Designing algorithms. Core skill.', color: '#a855f7', weight: 0.15, subCriteria: [] },
        'complexity-analysis': { name: 'Complexity Analysis', description: 'Analyzing time and space. Important for optimization.', color: '#d946ef', weight: 0.10, subCriteria: [] },
        'communication-clarity': { name: 'Communication Clarity', description: 'Explaining thought process. Critical for interviews.', color: '#ec4899', weight: 0.10, subCriteria: [] },
        'edge-case-awareness': { name: 'Edge Case Awareness', description: 'Handling edge cases. Shows thoroughness.', color: '#f43f5e', weight: 0.10, subCriteria: [] },
        'optimization-mindset': { name: 'Optimization Mindset', description: 'Seeking better solutions. Advanced skill.', color: '#f97316', weight: 0.15, subCriteria: [] },
        'debugging-approach': { name: 'Debugging Approach', description: 'Systematic error finding. Essential for real work.', color: '#eab308', weight: 0.10, subCriteria: [] },
    },
}));

describe('assess/complete page', () => {
    beforeEach(() => {
        mockSearchParams.clear();
    });
    afterEach(() => cleanup());

    it('shows weakest 2 dimensions with improvement suggestions', () => {
        const dimensions = {
            'problem-decomposition': 8.0,
            'pattern-recognition': 7.5,
            'algorithmic-thinking': 6.0,
            'complexity-analysis': 3.0,
            'communication-clarity': 7.0,
            'edge-case-awareness': 4.0,
            'optimization-mindset': 6.5,
            'debugging-approach': 5.0,
        };

        mockSearchParams.set('dimensions', encodeURIComponent(JSON.stringify(dimensions)));
        mockSearchParams.set('showScore', 'false');

        render(<AssessmentCompleteContent />);

        const workOnNext = screen.getByTestId('work-on-next');
        expect(workOnNext).toBeInTheDocument();
        // Weakest should be complexity-analysis (3.0) and edge-case-awareness (4.0)
        expect(workOnNext.textContent).toContain('Complexity Analysis');
        expect(workOnNext.textContent).toContain('Edge Case Awareness');
    });

    it('never shows hire_decision to candidate', () => {
        mockSearchParams.set('score', '7.5');
        mockSearchParams.set('showScore', 'true');

        render(<AssessmentCompleteContent />);

        // hire_decision should never appear anywhere on the candidate page
        expect(screen.queryByText(/STRONG_HIRE/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/NO_HIRE/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/BORDERLINE/i)).not.toBeInTheDocument();
        // "Hire" shouldn't appear in any context
        expect(screen.queryByText(/hire decision/i)).not.toBeInTheDocument();
    });

    it('shows numerical score only when campaign.show_score_to_candidate=true', () => {
        mockSearchParams.set('score', '7.5');
        mockSearchParams.set('showScore', 'false');

        const { unmount } = render(<AssessmentCompleteContent />);
        expect(screen.queryByTestId('score-display')).not.toBeInTheDocument();
        unmount();

        mockSearchParams.set('showScore', 'true');
        render(<AssessmentCompleteContent />);
        expect(screen.getByTestId('score-display')).toBeInTheDocument();
    });

    it('always shows "thank you" message and employer review note', () => {
        render(<AssessmentCompleteContent />);

        expect(screen.getByTestId('thank-you-title')).toHaveTextContent('Interview Complete');
        expect(screen.getByTestId('employer-review-note')).toBeInTheDocument();
        expect(screen.getByTestId('employer-review-note').textContent).toContain('reviewed by the employer');
    });

    it('shows dimension feedback when showScore is true', () => {
        const dimensions = {
            'problem-decomposition': 8.0,
            'pattern-recognition': 7.5,
            'algorithmic-thinking': 6.0,
            'complexity-analysis': 3.0,
            'communication-clarity': 7.0,
            'edge-case-awareness': 4.0,
            'optimization-mindset': 6.5,
            'debugging-approach': 5.0,
        };

        mockSearchParams.set('dimensions', encodeURIComponent(JSON.stringify(dimensions)));
        mockSearchParams.set('showScore', 'true');
        mockSearchParams.set('score', '5.8');

        render(<AssessmentCompleteContent />);

        expect(screen.getByTestId('dimension-feedback')).toBeInTheDocument();
        expect(screen.getByTestId('strongest-area')).toBeInTheDocument();
        // Strongest should be problem-decomposition (8.0)
        expect(screen.getByTestId('strongest-area').textContent).toContain('Problem Decomposition');
    });

    it('shows CTA to practice on AlgoMind', () => {
        render(<AssessmentCompleteContent />);
        expect(screen.getByText('Practice on AlgoMind')).toBeInTheDocument();
    });
});
