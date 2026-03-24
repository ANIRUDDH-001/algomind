/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { RecommendationBanner } from '../RecommendationBanner';

const pushMock = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
    push: pushMock,
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
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does render nothing when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const { container } = render(<RecommendationBanner />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows diagnostic prompt for new user (hasCompletedDiagnostic=false)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hasCompletedDiagnostic: false, nextConcept: null, weakest: [] }),
    }));

    render(<RecommendationBanner />);

    await waitFor(() => {
        expect(screen.queryByText(/take diagnostic/i)).not.toBeNull();
    });
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
    await waitFor(() => {
        expect(screen.queryByText(/Arrays & Strings/)).not.toBeNull();
    });
  });

  it('does hide when dismissed in diagnostic state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hasCompletedDiagnostic: false, nextConcept: null, weakest: [] }),
    }));

    render(<RecommendationBanner />);
    await waitFor(() => expect(screen.getByText(/take diagnostic/i)).toBeDefined());

    const dismiss = screen.getAllByRole('button', { name: '✕' })[0];
    dismiss.click();

    await waitFor(() => {
      expect(screen.queryByText(/take diagnostic/i)).toBeNull();
    });
  });

  it('does navigate to diagnostic on CTA click for new users', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ hasCompletedDiagnostic: false, nextConcept: null, weakest: [] }),
    }));

    render(<RecommendationBanner />);
    await waitFor(() => expect(screen.getByText(/take diagnostic/i)).toBeDefined());

    screen.getAllByRole('button', { name: /take diagnostic/i })[0]?.click();
    expect(pushMock).toHaveBeenCalledWith('/learn/diagnostic');
  });

  it('does navigate to learn route on Learn action click', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        hasCompletedDiagnostic: true,
        nextConcept: 'arrays-strings',
        weakest: [{ slug: 'arrays-strings', displayName: 'Arrays & Strings', confidence: 0.2 }],
      }),
    }));

    render(<RecommendationBanner />);
    await waitFor(() => expect(screen.getByText(/recommended for you/i)).toBeDefined());

    screen.getAllByRole('button', { name: /learn/i })[0]?.click();
    expect(pushMock).toHaveBeenCalledWith('/learn/arrays-strings');
  });
});