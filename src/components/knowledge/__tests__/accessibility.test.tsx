/**
 * @vitest-environment jsdom
 * @description Phase 3E Accessibility tests for knowledge components.
 *              Tests ARIA attributes, keyboard navigation, focus management.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConceptTile } from '../ConceptTile';
import { ConceptDetailPanel } from '../ConceptDetailPanel';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Play: () => <span>Play</span>,
  BookOpen: () => <span>Book</span>,
  TrendingUp: () => <span>Up</span>,
  TrendingDown: () => <span>Down</span>,
}));

const mockConcept = {
  slug: 'arrays-strings',
  displayName: 'Arrays & Strings',
  confidence: 0.75,
  level: 'strong' as const,
  evidenceCount: 4,
  icon: '[]',
  lastSessionType: 'learn' as const,
  lastSignalAt: null,
};

const mockUnassessedConcept = {
  slug: 'binary-search',
  displayName: 'Binary Search',
  confidence: 0,
  level: 'unknown' as const,
  evidenceCount: 0,
  icon: '🔍',
  lastSessionType: null,
  lastSignalAt: null,
};

// ── ConceptTile Accessibility ──────────────────────────────────

describe('Accessibility — ConceptTile', () => {
  afterEach(() => cleanup());

  it('has descriptive aria-label with confidence and level', () => {
    render(<ConceptTile concept={mockConcept} index={0} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Arrays & Strings: 75% confidence, strong level');
  });

  it('has aria-label for unassessed concept', () => {
    render(<ConceptTile concept={mockUnassessedConcept} index={0} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Binary Search: not yet assessed, unknown level');
  });

  it('has aria-pressed reflecting selection state', () => {
    const { rerender } = render(<ConceptTile concept={mockConcept} index={0} isSelected={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<ConceptTile concept={mockConcept} index={0} isSelected={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('has aria-describedby pointing to sr-only description', () => {
    render(<ConceptTile concept={mockConcept} index={0} />);
    const button = screen.getByRole('button');
    const descId = button.getAttribute('aria-describedby')!;
    expect(descId).toBe('tile-desc-arrays-strings');

    const desc = document.getElementById(descId);
    expect(desc).not.toBeNull();
    expect(desc!.textContent).toContain('4 session signals');
  });

  it('forwards onKeyDown handler', () => {
    const onKeyDown = vi.fn();
    render(<ConceptTile concept={mockConcept} index={0} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowRight' });
    expect(onKeyDown).toHaveBeenCalled();
  });
});

// ── ConceptDetailPanel Accessibility ───────────────────────────

describe('Accessibility — ConceptDetailPanel', () => {
  afterEach(() => cleanup());

  it('has role=dialog with aria-modal when open', () => {
    render(<ConceptDetailPanel concept={mockConcept} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('has descriptive aria-label', () => {
    render(<ConceptDetailPanel concept={mockConcept} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Arrays & Strings concept details');
  });

  it('close button has aria-label', () => {
    render(<ConceptDetailPanel concept={mockConcept} onClose={vi.fn()} />);
    expect(screen.getByTestId('concept-detail-close')).toHaveAttribute('aria-label', 'Close concept details panel');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(<ConceptDetailPanel concept={mockConcept} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when concept is null', () => {
    const { container } = render(<ConceptDetailPanel concept={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
