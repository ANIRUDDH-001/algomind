/**
 * @codesage
 * @file      src/components/interview/__tests__/GuestModeBanner.test.tsx
 * @purpose   Tests for the GuestModeBanner component.
 * @tech      Vitest, React Testing Library
 * @connects  ../GuestModeBanner
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
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { GuestModeBanner } from '../GuestModeBanner';

// Mock GUEST_SESSION_LIMITS (MAX_USER_TURNS = 10)
vi.mock('@/hooks/useGuestSession', () => ({
    GUEST_SESSION_LIMITS: { MAX_USER_TURNS: 10, MAX_AI_TURNS: 10 },
}));

describe('GuestModeBanner', () => {
    const defaultProps = {
        turnsUsed: 0,
        timeRemaining: 600,  // 10 minutes
        onSignUp: vi.fn(),
    };

    beforeEach(() => {
        sessionStorage.clear();
        vi.clearAllMocks();
    });

    it('renders with correct initial state', () => {
        const { container } = render(<GuestModeBanner {...defaultProps} />);
        expect(container.querySelector('[data-testid="guest-mode-banner"]')).not.toBeNull();
    });

    it('shows 10 rounds left initially', () => {
        const { container } = render(<GuestModeBanner {...defaultProps} turnsUsed={0} />);
        // The banner should contain "10" for rounds left
        expect(container.textContent).toContain('10');
        expect(container.textContent).toContain('round');
    });

    it('shows correct rounds remaining when some turns used', () => {
        render(<GuestModeBanner {...defaultProps} turnsUsed={3} />);
        // 10 - 3 = 7 rounds left
        expect(screen.getByText(/7/)).toBeTruthy();
    });

    it('displays time remaining correctly', () => {
        render(<GuestModeBanner {...defaultProps} timeRemaining={185} />);
        // 3:05
        expect(screen.getByText(/3:05/)).toBeTruthy();
    });

    it('hides when dismissed', () => {
        const { container } = render(<GuestModeBanner {...defaultProps} />);
        const dismissBtn = container.querySelector('[data-testid="dismiss-guest-banner"]');
        expect(dismissBtn).not.toBeNull();
        fireEvent.click(dismissBtn!);
        expect(container.querySelector('[data-testid="guest-mode-banner"]')).toBeNull();
    });

    it('persists dismissed state in sessionStorage', () => {
        const { container } = render(<GuestModeBanner {...defaultProps} />);
        const dismissBtn = container.querySelector('[data-testid="dismiss-guest-banner"]');
        fireEvent.click(dismissBtn!);
        expect(sessionStorage.getItem('algomind_guest_banner_dismissed')).toBe('true');
    });

    it('does not render if already dismissed in sessionStorage', () => {
        sessionStorage.setItem('algomind_guest_banner_dismissed', 'true');
        const { container } = render(<GuestModeBanner {...defaultProps} />);
        expect(container.querySelector('[data-testid="guest-mode-banner"]')).toBeNull();
    });
});
