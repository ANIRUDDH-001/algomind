'use client';

import { useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export interface UpgradeModalPayload {
  source?: string;
  reason?: string;
  sessionsUsed?: number;
  limit?: number;
}

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: UpgradeModalPayload | null;
}

export function UpgradeModal({ open, onOpenChange, payload }: UpgradeModalProps) {
  const router = useRouter();

  const description = useMemo(() => {
    if (typeof payload?.sessionsUsed === 'number' && typeof payload?.limit === 'number') {
      return `You have used ${payload.sessionsUsed}/${payload.limit} weekly free sessions. Upgrade to keep practicing without interruption.`;
    }

    if (payload?.reason) {
      return payload.reason;
    }

    return 'Upgrade to Premium for unlimited interview and learning sessions.';
  }, [payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">Weekly Session Limit Reached</DialogTitle>
          <DialogDescription className="text-zinc-300">{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">
          Premium includes unlimited sessions, advanced concept tracking, and faster feedback loops.
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            onClick={() => {
              onOpenChange(false);
              router.push('/employer');
            }}
          >
            Upgrade Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
