// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, style, 'data-testid': testId }: any) =>
            React.createElement('div', { className, style, 'data-testid': testId }, children),
    },
}));

// Mock next/navigation (used by ReportCard)
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock ReportCard — we only want to test the overlay chrome
vi.mock('@/components/assessment/ReportCard', () => ({
    ReportCard: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="mock-report-card">
            <button onClick={onClose}>Close Report</button>
        </div>
    ),
}));

// Minimal AssessmentResult fixture
import type { AssessmentResult } from '@/lib/assessment/analyzer';
const mockAssessment: AssessmentResult = {
    sessionId: 'test-session',
    timestamp: new Date(),
    problem: { title: 'Two Sum', description: 'desc', difficulty: 'easy' },
    skills: {} as AssessmentResult['skills'],
    overallFeedback: 'Good work',
    nextSteps: [],
    overallScore: 8.5,
    rawScore: 8.0,
    adjustedScore: 8.5,
};

import { GuestResultsOverlay } from '../GuestResultsOverlay';

describe('GuestResultsOverlay', () => {
    const defaultProps = {
        assessment: mockAssessment,
        durationSecs: 247,     // 4m 7s
        roundCount: 4,
        problemTitle: 'Two Sum',
        onTryAnother: vi.fn(),
        onSignUp: vi.fn(),
        onClose: vi.fn(),
    };

    it('renders without crashing', () => {
        const { container } = render(<GuestResultsOverlay {...defaultProps} />);
        expect(container.querySelector('[data-testid="guest-results-overlay"]')).not.toBeNull();
    });

    it('displays problem title and session stats', () => {
        const { container } = render(<GuestResultsOverlay {...defaultProps} />);
        // Problem title appears in sticky top bar (not queryByText since ReportCard may also show it)
        const topBar = container.querySelector('.sticky');
        expect(topBar).not.toBeNull();
        expect(topBar!.textContent).toContain('Two Sum');
        expect(topBar!.textContent).toContain('4 rounds');
        expect(topBar!.textContent).toContain('4m 7s');
    });

    it('calls onTryAnother when Try Another button is clicked', () => {
        const { container } = render(<GuestResultsOverlay {...defaultProps} />);
        const btn = container.querySelector('[data-testid="try-another-button"]');
        expect(btn).not.toBeNull();
        fireEvent.click(btn!);
        expect(defaultProps.onTryAnother).toHaveBeenCalledTimes(1);
    });

    it('calls onSignUp when Sign Up button is clicked', () => {
        const { container } = render(<GuestResultsOverlay {...defaultProps} />);
        const btn = container.querySelector('[data-testid="sign-up-button"]');
        expect(btn).not.toBeNull();
        fireEvent.click(btn!);
        expect(defaultProps.onSignUp).toHaveBeenCalledTimes(1);
    });

    it('renders ReportCard', () => {
        const { container } = render(<GuestResultsOverlay {...defaultProps} />);
        expect(container.querySelector('[data-testid="mock-report-card"]')).not.toBeNull();
    });

    it('shows the not-saved notice', () => {
        render(<GuestResultsOverlay {...defaultProps} />);
        expect(screen.getAllByText(/results not saved/i).length).toBeGreaterThan(0);
    });
});
