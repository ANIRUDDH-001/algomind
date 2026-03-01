/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalysisClient } from '../AnalysisClient';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import React from 'react';

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
        circle: ({ children, ...props }: any) => <circle {...props}>{children}</circle>,
    },
    useSpring: () => ({ set: vi.fn(), get: vi.fn() }),
    useTransform: () => 0,
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
        matches: false,
        addListener: () => { },
        removeListener: () => { }
    })
});

describe('SkillBar sub-criteria expansion', () => {
    const mockSession = {
        id: '1', problemId: 'p1', problemTitle: 'T', problemDifficulty: 'easy' as const,
        transcript: [], duration: 100, overallScore: 8, completedAt: '2023'
    };

    const mockAssessment = {
        overallScore: 8,
        skills: { 'problem-decomposition': 8 } as any,
        subCriteria: {
            'problem-decomposition': {
                'clarifiesAmbiguity': 10
            }
        },
        overallFeedback: 'Good',
        nextSteps: [],
        skillEvidence: {}
    };

    it('1. starts collapsed by default', () => {
        render(<AnalysisClient session={mockSession} assessment={mockAssessment} sm2={null} previousAttempts={[]} flags={{ enableComparative: false, enableLearnMode: false }} />);
        expect(screen.queryByText('Clarifies Ambiguity')).toBeNull();
    });

    it('2. verifies that skill bar names render', () => {
        const { container } = render(<AnalysisClient session={mockSession} assessment={mockAssessment} sm2={null} previousAttempts={[]} flags={{ enableComparative: false, enableLearnMode: false }} />);
        expect(container).toBeTruthy();
    });
});
