/**
 * @codesage
 * @file      src/components/upgrade/UpgradeModal.tsx
 * @purpose   Modal prompting users to upgrade when hitting limits or requesting premium features.
 * @tech      React, TailwindCSS, Next.js
 * @connects  next/navigation, @/components/ui/dialog, @/components/ui/button
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

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
      <DialogContent data-testid="upgrade-modal" className="max-w-md border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle data-testid="upgrade-modal-title" className="text-xl font-black tracking-tight">Weekly Session Limit Reached</DialogTitle>
          <DialogDescription className="text-zinc-300">{description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">
          Premium includes unlimited sessions, advanced concept tracking, and faster feedback loops.
        </div>

        <DialogFooter>
          <Button data-testid="upgrade-modal-close" variant="outline" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
          <Button
            data-testid="upgrade-modal-upgrade"
            className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            onClick={() => {
              onOpenChange(false);
              router.push('/settings');
            }}
          >
            View Plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
