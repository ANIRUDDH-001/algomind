/**
 * @codesage
 * @file      src/components/learn/__tests__/ConceptPicker.test.tsx
 * @purpose   Tests for ConceptPicker component.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, ConceptPicker
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
// @vitest-environment jsdom
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
  Brain: () => <span>Brain</span>,
  BookOpen: () => <span>BookOpen</span>,
  Code2: () => <span>Code2</span>,
  Search: () => <span>Search</span>,
  Database: () => <span>Database</span>,
  Activity: () => <span>Activity</span>,
  BarChart3: () => <span>BarChart3</span>,
  Clock: () => <span>Clock</span>,
  LayoutDashboard: () => <span>LayoutDashboard</span>,
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
          subscription: { sessionsUsedThisWeek: 0, sessionsRemaining: 5, weeklyLimit: 5 },
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
          subscription: { sessionsUsedThisWeek: 0, sessionsRemaining: 5, weeklyLimit: 5 },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start diagnostic/i }));
    expect(pushMock).toHaveBeenCalledWith('/learn/diagnostic');
  });

  it('does require confirmation when trying to skip diagnostic', async () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: false,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsUsedThisWeek: 0, sessionsRemaining: 5, weeklyLimit: 5 },
        }}
      />
    );

    // 1. Click the skip button
    fireEvent.click(screen.getByRole('button', { name: /skip and start with arrays & strings/i }));
    
    // 2. Check confirmation state is shown
    expect(screen.getByText(/skip baseline diagnostic\?/i)).toBeDefined();
    expect(pushMock).not.toHaveBeenCalled();

    // 3. Revert back to original diagnostic prompt
    fireEvent.click(screen.getByRole('button', { name: /go back to diagnostic/i }));
    expect(screen.getByText(/set your baseline first/i)).toBeDefined();

    // 4. Skip again and confirm
    fireEvent.click(screen.getByRole('button', { name: /skip and start with arrays & strings/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, start arrays & strings/i }));
    expect(pushMock).toHaveBeenCalledWith('/learn/arrays-strings');
  });

  it('does show recommendation and navigate on concept click for returning users', async () => {
    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: 'concept-2',
          weakestConcepts: [{ slug: 'concept-2', displayName: 'Concept 2', confidence: 0.2 }],
          subscription: { sessionsUsedThisWeek: 2, sessionsRemaining: 3, weeklyLimit: 5 },
        }}
      />
    );

    expect(screen.getByText(/kai recommends starting with/i)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /concept 0/i }));
    expect(pushMock).toHaveBeenCalledWith('/learn/concept-0');
  });

  it('does show limit warning and keeps concept cards clickable when weekly limit reached', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsUsedThisWeek: 5, sessionsRemaining: 0, weeklyLimit: 5 },
        }}
      />
    );

    expect(screen.getByText(/weekly limit reached: 5\/5 sessions used/i)).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: /concept 0/i })[0]);
    expect(pushMock).not.toHaveBeenCalledWith('/learn/concept-0');
    expect(dispatchSpy).toHaveBeenCalled();
  });

  it('does dispatch upgrade event from warning banner action', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(
      <ConceptPicker
        concepts={mockConcepts}
        studentContext={{
          hasCompletedDiagnostic: true,
          nextRecommendedConcept: null,
          weakestConcepts: [],
          subscription: { sessionsUsedThisWeek: 5, sessionsRemaining: 0, weeklyLimit: 5 },
        }}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /upgrade for unlimited access/i })[0]);
    expect(dispatchSpy).toHaveBeenCalled();
  });
});
