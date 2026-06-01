/**
 * @codesage
 * @file      src/components/interview/__tests__/GuestProblemSelectorModal.test.tsx
 * @purpose   Tests for the GuestProblemSelectorModal component.
 * @tech      Vitest, React Testing Library
 * @connects  ../GuestProblemSelectorModal
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { GuestProblemSelectorModal } from '../GuestProblemSelectorModal';
import { GUEST_PROBLEMS } from '@/lib/guest/guest-problems';

describe('GuestProblemSelectorModal', () => {
    it('renders nothing when isOpen is false', () => {
        const { container } = render(
            <GuestProblemSelectorModal isOpen={false} onSelect={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders all 5 problems when open', () => {
        const { container } = render(<GuestProblemSelectorModal isOpen={true} onSelect={vi.fn()} />);
        expect(container.querySelector('[data-testid="guest-selector-modal"]')).not.toBeNull();
        GUEST_PROBLEMS.forEach(p => {
            expect(container.querySelector(`[data-testid="problem-card-${p.id}"]`)).not.toBeNull();
        });
    });

    it('calls onSelect with correct problem when a card is clicked', () => {
        const onSelect = vi.fn();
        const { container } = render(<GuestProblemSelectorModal isOpen={true} onSelect={onSelect} />);
        const card = container.querySelector(`[data-testid="problem-card-${GUEST_PROBLEMS[0].id}"]`);
        expect(card).not.toBeNull();
        fireEvent.click(card!);
        expect(onSelect).toHaveBeenCalledWith(GUEST_PROBLEMS[0]);
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect with a problem when "Surprise Me" is clicked', () => {
        const onSelect = vi.fn();
        const { container } = render(<GuestProblemSelectorModal isOpen={true} onSelect={onSelect} />);
        const btn = container.querySelector('[data-testid="random-problem-button"]');
        expect(btn).not.toBeNull();
        fireEvent.click(btn!);
        expect(onSelect).toHaveBeenCalledTimes(1);
        // The selected problem must be one of the 5
        const selected = onSelect.mock.calls[0][0];
        expect(GUEST_PROBLEMS.map(p => p.id)).toContain(selected.id);
    });

    it('displays difficulty badge for each problem', () => {
        render(<GuestProblemSelectorModal isOpen={true} onSelect={vi.fn()} />);
        // At least one Easy badge should appear (Two Sum, Valid Parentheses, etc.)
        expect(screen.getAllByText(/easy/i).length).toBeGreaterThan(0);
    });
});
