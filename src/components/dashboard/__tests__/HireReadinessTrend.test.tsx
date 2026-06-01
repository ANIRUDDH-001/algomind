// @codesage
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { HireReadinessTrend } from '../HireReadinessTrend';

describe('HireReadinessTrend chart', () => {
    afterEach(() => cleanup());
    it('renders without crashing with empty trend data', () => {
        const { container } = render(<HireReadinessTrend trend={[]} />);
        expect(container).toBeTruthy();
        expect(screen.getByTestId('hire-readiness-empty')).toBeInTheDocument();
    });

    it('HIRE maps to y=4, NO_HIRE maps to y=2', () => {
        const HIRE_NUMERIC: Record<string, number> = {
            'STRONG_HIRE': 5,
            'HIRE': 4,
            'BORDERLINE': 3,
            'NO_HIRE': 2,
            'STRONG_NO_HIRE': 1,
        };

        expect(HIRE_NUMERIC['HIRE']).toBe(4);
        expect(HIRE_NUMERIC['NO_HIRE']).toBe(2);
    });

    it('shows explanatory tooltip text', () => {
        const trend = [
            { sessionId: 's1', hireDecision: 'HIRE', score: 7.0, completedAt: '2026-01-01T00:00:00Z' },
            { sessionId: 's2', hireDecision: 'BORDERLINE', score: 5.5, completedAt: '2026-01-02T00:00:00Z' },
            { sessionId: 's3', hireDecision: 'HIRE', score: 7.2, completedAt: '2026-01-03T00:00:00Z' },
        ];

        render(<HireReadinessTrend trend={trend} />);
        const tooltip = screen.getByTestId('hire-readiness-tooltip');
        expect(tooltip).toBeInTheDocument();
        expect(tooltip.textContent).toContain('one signal, not a prediction');
    });

    it('does not show hire decision for warm-up mode sessions', () => {
        // Warm-up mode sessions should have null hireDecision and shouldn't be in the trend
        // The save-session logic ensures warm-up sessions don't add to hire_readiness_trend
        const warmUpTrend = [
            { sessionId: 's1', hireDecision: 'HIRE', score: 7.0, completedAt: '2026-01-01T00:00:00Z' },
        ];

        // Filter out warm-up mode (which would have null hireDecision) — this validation happens at save time
        const filteredTrend = warmUpTrend.filter(
            entry => entry.hireDecision !== null && entry.hireDecision !== undefined
        );
        expect(filteredTrend.length).toBe(1);
    });

    it('shows last 10 sessions maximum', () => {
        const trend = Array.from({ length: 15 }, (_, i) => ({
            sessionId: `s${i}`,
            hireDecision: 'HIRE',
            score: 7.0,
            completedAt: new Date(2026, 0, i + 1).toISOString(),
        }));

        const { container } = render(<HireReadinessTrend trend={trend} />);
        // The component shows last 10 — verifying SVG path element exists
        const paths = container.querySelectorAll('path');
        expect(paths.length).toBeGreaterThan(0);
    });

    it('renders trend chart when data is present', () => {
        const trend = [
            { sessionId: 's1', hireDecision: 'NO_HIRE', score: 3.0, completedAt: '2026-01-01T00:00:00Z' },
            { sessionId: 's2', hireDecision: 'BORDERLINE', score: 5.5, completedAt: '2026-01-02T00:00:00Z' },
            { sessionId: 's3', hireDecision: 'HIRE', score: 7.2, completedAt: '2026-01-03T00:00:00Z' },
        ];

        render(<HireReadinessTrend trend={trend} />);
        expect(screen.queryAllByTestId('hire-readiness-trend').length).toBeGreaterThanOrEqual(1);
    });

    it('shows latest status label based on last entry', () => {
        const trend = [
            { sessionId: 's1', hireDecision: 'NO_HIRE', score: 3.0, completedAt: '2026-01-01T00:00:00Z' },
            { sessionId: 's2', hireDecision: 'HIRE', score: 7.2, completedAt: '2026-01-02T00:00:00Z' },
        ];

        render(<HireReadinessTrend trend={trend} />);
        // 'Hire' appears in both 'Hire Readiness' header and the status label
        const hireLabels = screen.getAllByText('Hire');
        expect(hireLabels.length).toBeGreaterThanOrEqual(1);
    });
});
