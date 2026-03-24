/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UpgradeModal } from '../UpgradeModal';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderModal(open = true, payload: Parameters<typeof UpgradeModal>[0]['payload'] = null, onOpenChange = vi.fn()) {
  return render(<UpgradeModal open={open} onOpenChange={onOpenChange} payload={payload} />);
}

describe('UpgradeModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does render nothing when open is false', () => {
    const { container } = renderModal(false);
    expect(container.firstChild).toBeNull();
  });

  it('does render weekly limit title when open is true', () => {
    renderModal(true);
    expect(screen.getByText(/weekly session limit reached/i)).toBeDefined();
  });

  it('does show sessions used text when payload includes usage', () => {
    renderModal(true, { reason: 'limit_reached', sessionsUsed: 5, limit: 5 });
    expect(screen.getByText(/5\/5 weekly free sessions/i)).toBeDefined();
  });

  it('does close when Maybe Later is clicked', async () => {
    const onOpenChange = vi.fn();
    renderModal(true, null, onOpenChange);

    fireEvent.click(screen.getAllByRole('button', { name: /maybe later/i })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does close and navigate when Upgrade Now is clicked', async () => {
    const onOpenChange = vi.fn();
    renderModal(true, null, onOpenChange);

    fireEvent.click(screen.getAllByRole('button', { name: /upgrade now/i })[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pushMock).toHaveBeenCalledWith('/employer');
  });

  it('does show fallback reason text from payload', () => {
    renderModal(true, { reason: 'custom_reason' });
    expect(screen.getByText('custom_reason')).toBeDefined();
  });
});
