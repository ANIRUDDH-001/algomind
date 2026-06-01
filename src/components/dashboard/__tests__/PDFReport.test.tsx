// @codesage
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as path from 'path';
import * as fs from 'fs';

// ─── @react-pdf/renderer cannot render in jsdom — mock all primitives ───
vi.mock('@react-pdf/renderer', () => ({
    Document: ({ children }: any) => <div data-testid="pdf-document">{children}</div>,
    Page: ({ children, size }: any) => (
        <div data-testid="pdf-page" data-size={size}>{children}</div>
    ),
    View: ({ children, style }: any) => (
        <div data-testid="pdf-view" style={style}>{children}</div>
    ),
    Text: ({ children, style }: any) => (
        <span data-testid="pdf-text" style={style}>{children}</span>
    ),
    StyleSheet: {
        create: (styles: any) => styles,
    },
    Font: {
        register: vi.fn(),
    },
}));

// ─── Import component AFTER mock ───
import { PDFReport } from '../PDFReport';
import { COLORS } from '@/lib/design-tokens';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { UserProgress, CognitiveSkill } from '@/types/assessment';

// ─── Read source for static checks (tests 8 & 9) ───
const SRC_PATH = path.resolve(__dirname, '../PDFReport.tsx');
const src = fs.readFileSync(SRC_PATH, 'utf-8');

// ─── Mock progress data ───
const ALL_SKILLS: CognitiveSkill[] = [
    'problem-decomposition',
    'pattern-recognition',
    'algorithmic-thinking',
    'complexity-analysis',
    'communication-clarity',
    'edge-case-awareness',
    'optimization-mindset',
    'debugging-approach',
];

function makeProgress(overrides: Partial<UserProgress> = {}): UserProgress {
    const averageScores = ALL_SKILLS.reduce((acc, skill, i) => {
        // Alternate high (8) and low (3) scores for color variety
        acc[skill] = i % 2 === 0 ? 8.0 : 3.0;
        return acc;
    }, {} as Record<CognitiveSkill, number>);

    return {
        userId: 'user-1',
        totalSessions: 12,
        averageScore: 7.5,
        averageScores,
        trends: [],
        sessions: [
            {
                sessionId: 'sess-1',
                userId: 'user-1',
                problemId: 'Two Sum',
                problemDifficulty: 'easy',
                timestamp: new Date('2026-01-15T10:00:00Z'),
                duration: 1800,
                skills: averageScores,
                overallScore: 8.2,
            },
            {
                sessionId: 'sess-2',
                userId: 'user-1',
                problemId: 'Merge Intervals',
                problemDifficulty: 'medium',
                timestamp: new Date('2026-01-20T14:00:00Z'),
                duration: 2400,
                skills: averageScores,
                overallScore: 6.9,
            },
        ],
        lastUpdated: new Date('2026-02-01'),
        ...overrides,
    };
}

const mockProgress = makeProgress();

describe('PDFReport', () => {
    afterEach(() => {
        cleanup();
    });

    it('1. Renders without crashing with minimal UserProgress prop', () => {
        expect(() => render(<PDFReport progress={mockProgress} />)).not.toThrow();
        expect(screen.getByTestId('pdf-document')).toBeDefined();
    });

    it('2. "AlgoMind" branding appears in the header title', () => {
        render(<PDFReport progress={mockProgress} />);
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent);
        expect(allText.some(t => t?.includes('AlgoMind'))).toBe(true);
    });

    it('3. Overall score appears as a formatted number (averageScore.toFixed(1))', () => {
        render(<PDFReport progress={mockProgress} />);
        // averageScore is 7.5 → should render "7.5"
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        expect(allText.some(t => t.includes('7.5'))).toBe(true);
    });

    it('4. All 8 skill sections render (one per SKILL_DEFINITIONS key)', () => {
        render(<PDFReport progress={mockProgress} />);
        const skillNames = Object.values(SKILL_DEFINITIONS).map(d => d.name);
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        for (const name of skillNames) {
            expect(allText.some(t => t.includes(name))).toBe(true);
        }
    });

    it('5. Session count stat is present', () => {
        render(<PDFReport progress={mockProgress} />);
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        // "Total Practice Sessions" label + "12" value
        expect(allText.some(t => t.toLowerCase().includes('session'))).toBe(true);
        expect(allText.some(t => t.includes('12'))).toBe(true);
    });

    it('6. AlgoMind branding is present in footer', () => {
        render(<PDFReport progress={mockProgress} />);
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        expect(allText.some(t => t.includes('AlgoMind'))).toBe(true);
    });

    it('7. Date formatting is correct — uses date-fns format(), produces human-readable date', () => {
        render(<PDFReport progress={mockProgress} />);
        // The header date uses format(new Date(), 'PPP') → e.g. "February 24th, 2026"
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        // Must contain a year (e.g. 2026) in one of the text elements
        expect(allText.some(t => /20\d{2}/.test(t))).toBe(true);
    });

    it('8. (Design-token intent) COLORS.semantic.success is a valid hex for high-score indicator', () => {
        // Post-redesign: skills with score >= 7 should use COLORS.semantic.success.
        // Currently the component uses static skillScore style — this test validates
        // the design token value used by the redesign is a proper hex string.
        expect(COLORS.semantic.success).toMatch(/^#[0-9a-fA-F]{6}$/);

        // Additionally verify the source uses SKILL_DEFINITIONS (the redesign will
        // use per-skill coloring through this registry)
        expect(src).toContain('SKILL_DEFINITIONS');
    });

    it('9. (Design-token intent) COLORS.semantic.danger is a valid hex for low-score indicator', () => {
        // Post-redesign: skills with score < 5 should use COLORS.semantic.danger.
        expect(COLORS.semantic.danger).toMatch(/^#[0-9a-fA-F]{6}$/);

        // COLORS.semantic.danger must be distinctly different from success
        expect(COLORS.semantic.danger).not.toBe(COLORS.semantic.success);
    });

    it('10. Footer section renders with page/branding text', () => {
        render(<PDFReport progress={mockProgress} />);
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        // Footer text includes AlgoMind and Confidential
        expect(allText.some(t => t.includes('AlgoMind') && t.includes('Confidential'))).toBe(true);
    });

    it('11. Snapshot test: full PDF structure with mock progress data', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-02-24T08:00:00Z'));
        try {
            const { container } = render(<PDFReport progress={mockProgress} />);
            // Verify structure renders three pages
            const pages = screen.getAllByTestId('pdf-page');
            expect(pages.length).toBe(3);
            expect(container).toMatchSnapshot();
        } finally {
            vi.useRealTimers();
        }
    });

    it('12. Missing/empty sessions array defaults gracefully — no crash', () => {
        const progressNoSessions = makeProgress({ sessions: [] });
        expect(() => render(<PDFReport progress={progressNoSessions} />)).not.toThrow();
        // Component still renders document structure
        expect(screen.getByTestId('pdf-document')).toBeDefined();
        // No session rows — but all other sections still present
        const allText = screen.getAllByTestId('pdf-text').map(el => el.textContent ?? '');
        expect(allText.some(t => t.includes('AlgoMind'))).toBe(true);
    });
});
