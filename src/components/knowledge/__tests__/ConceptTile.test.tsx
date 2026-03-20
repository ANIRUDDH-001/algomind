/**
 * @vitest-environment jsdom
 */
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

    expect(screen.getByText('[]')).toBeDefined();
    expect(screen.getByText('Arrays')).toBeDefined();
    expect(screen.getByText('75%')).toBeDefined();
  });

  it('does show dash when evidenceCount is zero', () => {
    render(<ConceptTile concept={{ ...baseConcept, evidenceCount: 0 }} index={0} />);

    expect(screen.getByText('-')).toBeDefined();
  });

  it('does apply selected and active rings when flags are true', () => {
    render(<ConceptTile concept={baseConcept} index={0} isSelected isActiveLearning />);

    const tile = screen.getAllByTestId('concept-tile-arrays-strings')[0];
    expect(tile.className).toContain('ring-indigo-500/60');
    expect(tile.className).toContain('ring-emerald-500/60');
  });

  it('does call onClick with concept payload', async () => {
    const onClick = vi.fn();
    render(<ConceptTile concept={baseConcept} index={0} onClick={onClick} />);

    fireEvent.click(screen.getAllByTestId('concept-tile-arrays-strings')[0]);
    expect(onClick).toHaveBeenCalledWith(baseConcept);
  });
});
