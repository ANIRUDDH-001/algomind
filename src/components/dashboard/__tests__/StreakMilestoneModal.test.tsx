// @codesage
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StreakMilestoneModal } from '../StreakMilestoneModal';

// Mock framer-motion to render children immediately
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('StreakMilestoneModal', () => {
    it('renders for milestone streaks (7)', () => {
        const onDismiss = vi.fn();
        render(<StreakMilestoneModal streak={7} isNewRecord={false} onDismiss={onDismiss} />);
        expect(screen.getByText(/7-Day Streak/i)).toBeDefined();
    });

    it('does NOT render for non-milestone streaks (4)', () => {
        const onDismiss = vi.fn();
        const { container } = render(
            <StreakMilestoneModal streak={4} isNewRecord={false} onDismiss={onDismiss} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('shows new record text when isNewRecord is true', () => {
        render(<StreakMilestoneModal streak={30} isNewRecord={true} onDismiss={vi.fn()} />);
        expect(screen.getByText(/New Record/i)).toBeDefined();
    });

    it('auto-dismisses after 3 seconds', async () => {
        vi.useFakeTimers();
        const onDismiss = vi.fn();
        render(<StreakMilestoneModal streak={7} isNewRecord={false} onDismiss={onDismiss} />);

        expect(onDismiss).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(3001); });
        expect(onDismiss).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });

    it('renders all milestone thresholds correctly', () => {
        const milestones = [3, 7, 14, 30, 50, 100];
        milestones.forEach(streak => {
            const { container } = render(
                <StreakMilestoneModal streak={streak} isNewRecord={false} onDismiss={vi.fn()} />
            );
            expect(container.firstChild).not.toBeNull();
        });
    });
});
