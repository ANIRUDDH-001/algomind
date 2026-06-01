// @codesage
/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeeklyUsageCard } from '../WeeklyUsageCard';

// Mock framer-motion to avoid animation-related failures in JSDOM
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, style, ...props }: any) => <div {...props} style={style}>{children}</div>,
    },
}));

describe('WeeklyUsageCard', () => {
    beforeEach(() => {
        cleanup();
        vi.stubGlobal('fetch', vi.fn());
    });

    it('shows session count and limit for free user', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                sessionsUsed: 2,
                limit: 5,
                sessionsRemaining: 3,
                subscriptionStatus: 'free'
            }),
        } as Response);
        render(<WeeklyUsageCard />);
        await waitFor(() => {
            expect(screen.queryByText('2')).not.toBeNull();
            expect(screen.queryByText(/5 sessions/i)).not.toBeNull();
        });
    });

    it('shows unlimited for premium user', async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                sessionsUsed: 10,
                limit: null,
                sessionsRemaining: null,
                subscriptionStatus: 'premium'
            }),
        } as Response);
        render(<WeeklyUsageCard />);
        await waitFor(() => {
            expect(screen.queryByText('∞')).not.toBeNull();
            expect(screen.queryByText(/Premium/i)).not.toBeNull();
        });
    });

    it('shows loading skeleton before data', () => {
        vi.mocked(fetch).mockReturnValue(new Promise(() => { })); // never resolves
        const { container } = render(<WeeklyUsageCard />);
        expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
});