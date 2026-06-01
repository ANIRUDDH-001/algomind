/**
 * @codesage
 * @file      src/app/owner/tabs/algomind-2o-tab.tsx
 * @purpose   AlgoMind 2.0 tab for managing session gating and user subscriptions.
 * @tech      React
 * @connects  Imports KGStatsPanel, SessionGateControlPanel, UserSubscriptionPanel
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
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
          Control session gating limits and user subscriptions for AlgoMind 2.0.
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
