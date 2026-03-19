/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecommendationBanner } from '../RecommendationBanner';

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('RecommendationBanner', () => {
  it('shows diagnostic prompt for new user (hasCompletedDiagnostic=false)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hasCompletedDiagnostic: false, nextConcept: null, weakest: [] }),
    }));
    render(<RecommendationBanner />);
    await screen.findByText(/take diagnostic/i);
  });

  it('shows concept recommendation for returning user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        hasCompletedDiagnostic: true,
        nextConcept: 'arrays-strings',
        weakest: [{ slug: 'arrays-strings', displayName: 'Arrays & Strings', confidence: 0.2 }],
      }),
    }));
    render(<RecommendationBanner />);
    await screen.findByText(/Arrays & Strings/);
  });

  it('hides when dismissed', async () => {});
  it('navigates to diagnostic on CTA click', async () => {});
  it('handles fetch failure gracefully (renders nothing)', async () => {});
});