/**
 * @codesage
 * @file      src/components/practice/__tests__/DifficultyModeSelector.test.tsx
 * @purpose   Tests for DifficultyModeSelector component.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, DifficultyModeSelector
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DifficultyModeSelector } from '../DifficultyModeSelector';

// Mock useGlobalFeatureFlag
const mockUseGlobalFeatureFlag = vi.fn();
vi.mock('@/hooks/useGlobalFeatureFlag', () => ({
    useGlobalFeatureFlag: (...args: unknown[]) => mockUseGlobalFeatureFlag(...args),
}));

describe('DifficultyModeSelector', () => {
    const defaultProps = {
        selectedMode: 'practice' as const,
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseGlobalFeatureFlag.mockReturnValue(true);
    });

    it('renders all 4 mode cards', () => {
        render(<DifficultyModeSelector {...defaultProps} />);
        expect(screen.getAllByTestId(/^mode-card-/)).toHaveLength(4);
    });

    it('Practice mode is selected by default', () => {
        render(<DifficultyModeSelector {...defaultProps} />);
        const practiceCards = screen.getAllByTestId('mode-card-practice');
        // Selected card has the bg tint class
        expect(practiceCards[0].className).toContain('bg-amber-500/10');
    });

    it('clicking a mode card calls onChange with correct mode', () => {
        render(<DifficultyModeSelector {...defaultProps} />);
        const crunchCards = screen.getAllByTestId('mode-card-crunch');
        fireEvent.click(crunchCards[0]);
        expect(defaultProps.onChange).toHaveBeenCalledWith('crunch');
    });

    it('selected card has distinct visual treatment (different class)', () => {
        render(<DifficultyModeSelector selectedMode="warm-up" onChange={defaultProps.onChange} />);
        const warmUpCards = screen.getAllByTestId('mode-card-warm-up');
        const practiceCards = screen.getAllByTestId('mode-card-practice');

        // Selected and unselected cards should have different class names
        expect(warmUpCards[0].className).not.toBe(practiceCards[0].className);
    });

    it('company tags toggle is hidden by default', () => {
        render(
            <DifficultyModeSelector {...defaultProps}>
                <div data-testid="company-pills">Company Pills</div>
            </DifficultyModeSelector>
        );
        expect(screen.queryByTestId('company-filters')).toBeNull();
    });

    it('company tags toggle shows company filter when clicked', () => {
        const { container } = render(
            <DifficultyModeSelector {...defaultProps}>
                <div data-testid="company-pills">Company Pills</div>
            </DifficultyModeSelector>
        );
        const toggle = container.querySelector('[data-testid="company-context-toggle"]');
        expect(toggle).not.toBeNull();
        fireEvent.click(toggle!);
        // After click, the company pills should appear
        expect(screen.getByText('Company Pills')).toBeDefined();
    });

    it('does not render when ENABLE_DIFFICULTY_MODES flag is false', () => {
        mockUseGlobalFeatureFlag.mockReturnValue(false);
        const { container } = render(<DifficultyModeSelector {...defaultProps} />);
        expect(container.innerHTML).toBe('');
    });
});
