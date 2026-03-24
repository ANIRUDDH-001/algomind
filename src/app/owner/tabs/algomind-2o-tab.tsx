'use client';

import { KGStatsPanel } from '@/components/owner/KGStatsPanel';
import { SessionGateControlPanel } from '@/components/owner/SessionGateControlPanel';
import { UserSubscriptionPanel } from '@/components/owner/UserSubscriptionPanel';

export function AlgoMind2OTab() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-base font-bold text-white">AlgoMind 2.0</h2>
        <p className="text-xs text-zinc-500">
          Manage knowledge graphs, session gating, and user subscriptions for AlgoMind 2.0 features.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <KGStatsPanel />
        <SessionGateControlPanel />
        <UserSubscriptionPanel />
      </div>
    </div>
  );
}
