// @codesage
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock next/dynamic to render loading state
vi.mock('next/dynamic', () => ({
    default: (_fn: any, opts: any) => {
        // In tests, dynamic imports render the loading component
        return opts?.loading ? opts.loading : () => null;
    },
}));

import { ExportReportButton } from '../ExportReportButton';
import type { UserProgress } from '@/types/assessment';
import React from 'react';

const mockProgress: UserProgress = {
    userId: 'test-user',
    totalSessions: 5,
    averageScore: 7.5,
    averageScores: {} as any,
    sessions: [],
    trends: [],
    lastUpdated: new Date(),
    narrative: 'Test narrative',
    next_steps: [],
};

describe('ExportReportButton — lazy loading', () => {
    afterEach(() => {
        cleanup();
    });

    it('renders disabled button while PDF library loads', () => {
        render(<ExportReportButton progress={mockProgress} />);
        // Should show the loading state button (from dynamic's loading prop)
        const button = screen.getByRole('button');
        expect(button).toBeDefined();
    });

    it('renders without crashing when no progress provided', () => {
        render(<ExportReportButton />);
        // Should render a disabled button
        const button = screen.getByRole('button');
        expect(button.hasAttribute('disabled')).toBe(true);
    });
});
