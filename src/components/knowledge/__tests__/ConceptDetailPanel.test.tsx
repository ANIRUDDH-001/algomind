/**
 * @codesage
 * @file      src/components/knowledge/__tests__/ConceptDetailPanel.test.tsx
 * @purpose   Tests for ConceptDetailPanel.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, ConceptDetailPanel
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConceptDetailPanel } from '../ConceptDetailPanel';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Play: () => <span>Play</span>,
  BookOpen: () => <span>Book</span>,
  TrendingUp: () => <span>Up</span>,
  TrendingDown: () => <span>Down</span>,
}));

const concept = {
  slug: 'arrays-strings',
  displayName: 'Arrays & Strings',
  confidence: 0.42,
  level: 'weak' as const,
  evidenceCount: 3,
  icon: '[]',
  lastSessionType: 'learn' as const,
  lastSignalAt: null,
};

describe('ConceptDetailPanel', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does render nothing when concept is null', () => {
    const { container } = render(<ConceptDetailPanel concept={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('does render concept details and confidence', () => {
    render(<ConceptDetailPanel concept={concept} onClose={vi.fn()} />);
    expect(screen.getByText('Arrays & Strings')).toBeDefined();
    expect(screen.getByText('42%')).toBeDefined();
    expect(screen.getByText(/based on/i)).toBeDefined();
  });

  it('does call onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<ConceptDetailPanel concept={concept} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('concept-detail-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does navigate to learn and interview actions', async () => {
    render(<ConceptDetailPanel concept={concept} onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole('button', { name: /learn with kai/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /practice interview/i })[0]);

    expect(pushMock).toHaveBeenCalledWith('/learn/arrays-strings');
    expect(pushMock).toHaveBeenCalledWith('/interview?concept=arrays-strings');
  });
});
