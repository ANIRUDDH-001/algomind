/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConceptPicker } from '../ConceptPicker';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <span>Sparkles</span>,
  ArrowRight: () => <span>Arrow</span>,
  Target: () => <span>Target</span>,
  Zap: () => <span>Zap</span>,
}));

const mockConcepts = Array.from({ length: 20 }, (_, i) => ({
  slug: `concept-${i}`,
  displayName: `Concept ${i}`,
  confidence: i === 2 ? 0.2 : 0.5,
  level: 'developing' as const,
  evidenceCount: 1,
  icon: '[]',
  lastSessionType: null,
  lastSignalAt: null,
}));

describe('ConceptPicker', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does show diagnostic prompt for users without baseline', () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: false,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsRemaining: 5, weeklyLimit: 5 },
        }}
      />
    );

    expect(screen.getByText(/set your baseline first/i)).toBeDefined();
    expect(screen.getByText(/start diagnostic/i)).toBeDefined();
  });

  it('does navigate to diagnostic when CTA is clicked', async () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: false,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsRemaining: 5, weeklyLimit: 5 },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start diagnostic/i }));
    expect(pushMock).toHaveBeenCalledWith('/learn/diagnostic');
  });

  it('does show recommendation and navigate on concept click for returning users', async () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: 'concept-2',
          weakestConcepts: [{ slug: 'concept-2', displayName: 'Concept 2', confidence: 0.2 }],
          subscription: { sessionsRemaining: 3, weeklyLimit: 5 },
        }}
      />
    );

    expect(screen.getByText(/kai recommends starting with/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /concept 0/i }));
    expect(pushMock).toHaveBeenCalledWith('/learn/concept-0');
  });

  it('does disable concept cards when weekly limit reached', () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsRemaining: 0, weeklyLimit: 5 },
        }}
      />
    );

    expect(screen.getByText(/used all 5 sessions this week/i)).toBeDefined();
    expect(screen.getAllByRole('button', { name: /concept 0/i })[0]?.hasAttribute('disabled')).toBe(true);
  });

  it('does dispatch upgrade event from warning banner action', async () => {
    const dispatchSpy = vi.spyOn(document, 'dispatchEvent');

    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsRemaining: 0, weeklyLimit: 5 },
        }}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /upgrade for unlimited access/i })[0]);
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
