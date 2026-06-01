/**
 * @codesage
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DashboardNav } from '@/components/dashboard/DashboardNav';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

// Mock lucide-react so icons don't need SVG support
vi.mock('lucide-react', () => ({
    LayoutGrid: () => <svg data-testid="icon-overview" />,
    Brain: () => <svg data-testid="icon-knowledge" />,
    BarChart3: () => <svg data-testid="icon-skills" />,
    History: () => <svg data-testid="icon-history" />,
    Lightbulb: () => <svg data-testid="icon-insights" />,
}));

describe('DashboardNav', () => {
    const mockOnTabChange = vi.fn();

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. Renders the main dashboard tabs including Knowledge', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        expect(screen.getByText('Overview')).toBeDefined();
        expect(screen.getByText('Knowledge')).toBeDefined();
        expect(screen.getByText('Skills')).toBeDefined();
        expect(screen.getByText('History')).toBeDefined();
        expect(screen.getByText('Insights')).toBeDefined();
    });

    it('2. Active tab has gradient background style', () => {
        render(<DashboardNav activeTab="skills" onTabChange={mockOnTabChange} />);
        // The active button has inline style with linear-gradient
        const skillsButton = screen.getByText('Skills').closest('button')!;
        expect(skillsButton.style.background).toContain('linear-gradient');
    });

    it('3. Inactive tabs do NOT have gradient background style', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        const skillsButton = screen.getByText('Skills').closest('button')!;
        const historyButton = screen.getByText('History').closest('button')!;
        expect(skillsButton.style.background).toBe('');
        expect(historyButton.style.background).toBe('');
    });

    it('4. Clicking a tab calls onTabChange with correct tab ID', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        fireEvent.click(screen.getByText('Skills').closest('button')!);
        expect(mockOnTabChange).toHaveBeenCalledWith('skills');

        fireEvent.click(screen.getByText('History').closest('button')!);
        expect(mockOnTabChange).toHaveBeenCalledWith('history');
    });

    it('5. All tabs have accessible text labels (not just icons)', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        const labels = ['Overview', 'Knowledge', 'Skills', 'History', 'Insights'];
        labels.forEach(label => {
            expect(screen.getByText(label)).toBeDefined();
        });
    });

    it('6. Overview tab has data-tour="tab-overview" attribute', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        const overviewButton = screen.getByText('Overview').closest('button')!;
        expect(overviewButton.getAttribute('data-tour')).toBe('tab-overview');
    });

    it('6b. All tabs have correct data-tour attributes', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        const tourIds = ['tab-overview', 'tab-knowledge', 'tab-skills', 'tab-history', 'tab-insights'];
        tourIds.forEach(tourId => {
            expect(document.querySelector(`[data-tour="${tourId}"]`)).not.toBeNull();
        });
    });

    it('7. Total of 5 tab buttons rendered', () => {
        render(<DashboardNav activeTab="overview" onTabChange={mockOnTabChange} />);
        const nav = document.querySelector('nav')!;
        const buttons = nav.querySelectorAll('button');
        expect(buttons).toHaveLength(5);
    });

    it('8. Passing activeTab="skills" marks Skills button as active with gradient', () => {
        render(<DashboardNav activeTab="skills" onTabChange={mockOnTabChange} />);
        const skillsButton = screen.getByText('Skills').closest('button')!;
        const overviewButton = screen.getByText('Overview').closest('button')!;

        // Active
        expect(skillsButton.style.background).toContain('linear-gradient');
        // Inactive
        expect(overviewButton.style.background).toBe('');
    });
});
