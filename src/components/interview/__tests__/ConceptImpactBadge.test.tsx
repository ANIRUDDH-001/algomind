// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { ConceptImpactBadge } from '../ConceptImpactBadge';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

describe('ConceptImpactBadge', () => {
  it('renders nothing for empty impacts', () => {
    const { container } = render(<ConceptImpactBadge impacts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows green badge for positive delta', () => {
    render(
      <ConceptImpactBadge
        impacts={[{ slug: 'arrays', displayName: 'Arrays', delta: 0.12, confidenceAfter: 0.72 }]}
      />
    );

    const item = screen.getByText('Arrays').closest('div');
    expect(item?.className).toContain('text-emerald-400');
  });

  it('shows red badge for negative delta', () => {
    render(
      <ConceptImpactBadge
        impacts={[{ slug: 'dp', displayName: 'Dynamic Programming', delta: -0.25, confidenceAfter: 0.41 }]}
      />
    );

    const item = screen.getByText('Dynamic Programming').closest('div');
    expect(item?.className).toContain('text-red-400');
  });

  it('shows neutral badge for near-zero delta', () => {
    render(
      <ConceptImpactBadge
        impacts={[{ slug: 'graphs', displayName: 'Graphs', delta: 0.001, confidenceAfter: 0.5 }]}
      />
    );

    const item = screen.getByText('Graphs').closest('div');
    expect(item?.className).toContain('text-zinc-400');
  });

  it('shows correct percentage delta', () => {
    const { getByText } = render(
      <ConceptImpactBadge
        impacts={[{ slug: 'heap', displayName: 'Heap', delta: 0.08, confidenceAfter: 0.55 }]}
      />
    );

    expect(getByText('+8%')).not.toBeNull();
  });
});
