/**
 * @codesage
 * @file      src/components/knowledge/__tests__/ConceptTile.test.tsx
 * @purpose   Tests for ConceptTile.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, ConceptTile
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
import { ConceptTile } from '../ConceptTile';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

const baseConcept = {
  slug: 'arrays-strings',
  displayName: 'Arrays',
  confidence: 0.75,
  level: 'solid' as const,
  evidenceCount: 4,
  icon: '[]',
  lastSessionType: null,
  lastSignalAt: null,
};

describe('ConceptTile', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does render icon, name, and confidence percentage', () => {
    render(<ConceptTile concept={baseConcept} index={0} />);

    expect(screen.getByRole('button').querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Arrays')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('does show dash when evidenceCount is zero', () => {
    render(<ConceptTile concept={{ ...baseConcept, evidenceCount: 0 }} index={0} />);

    expect(screen.getByText('-')).toBeDefined();
  });

  it('does apply selected and active rings when flags are true', () => {
    render(<ConceptTile concept={baseConcept} index={0} isSelected isActiveLearning />);

    const tile = screen.getByTestId('concept-tile');
    expect(tile.className).toContain('ring-indigo-500/60');
    expect(tile.className).toContain('ring-emerald-500/60');
  });

  it('does call onClick with concept payload', async () => {
    const onClick = vi.fn();
    render(<ConceptTile concept={baseConcept} index={0} onClick={onClick} />);

    fireEvent.click(screen.getByTestId('concept-tile'));
    expect(onClick).toHaveBeenCalledWith(baseConcept);
  });
});
