/**
 * @codesage
 * @component WeeklyUsageCard
 * @description Dashboard card showing weekly session usage.
 *              Replaces deprecated DailyQuestionsCard.
 * @phase Phase 2K
 */
// @ts-nocheck

// 

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface WeeklyUsage {
  sessionsUsed: number;
  limit: number | null;
  sessionsRemaining: number | null;
  subscriptionStatus: 'free' | 'premium' | 'college';
  learn?: {
    used: number;
    limit: number | null;
    remaining: number | null;
  };
}

export function WeeklyUsageCard() {
  const [data, setData] = useState<WeeklyUsage | null>(null);

  useEffect(() => {
    fetch('/api/knowledge/session-limit')
      .then(r => r.json())
      .then(setData)
      .catch(() => null);
  }, []);

  if (!data) {
    return <div className="rounded-2xl bg-[#111118] border border-[#1E1E2E] h-28 animate-pulse" />;
  }

  const isPremium = data.subscriptionStatus !== 'free';
  const used = data.learn?.used ?? data.sessionsUsed ?? 0;
  const limit = data.learn?.limit ?? data.limit;
  const remaining = data.learn?.remaining ?? data.sessionsRemaining;
  const pct = isPremium ? 100 : Math.min(100, (used / (limit ?? 5)) * 100);

  return (
    <div className="rounded-2xl bg-[#111118] border border-[#1E1E2E] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">This Week</h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-black text-white tabular-nums">
              {isPremium ? '∞' : used}
            </span>
            {!isPremium && limit && (
              <span className="text-sm text-zinc-500">/ {limit} sessions</span>
            )}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isPremium ? 'bg-emerald-950/60 border border-emerald-500/20' : 'bg-zinc-900 border border-zinc-700/30'}`}>
          <Zap size={16} className={isPremium ? 'text-emerald-400' : 'text-zinc-400'} />
        </div>
      </div>

      {/* Progress bar */}
      {!isPremium && (
        <>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${pct >= 80 ? 'bg-red-500' : 'bg-indigo-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {remaining === 0
              ? 'Limit reached — resets next Monday'
              : `${remaining} session${remaining !== 1 ? 's' : ''} remaining this week`
            }
          </p>
          {(remaining ?? 0) <= 1 && remaining !== null && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('algomind:upgrade-modal', {
                detail: {
                  source: 'dashboard-weekly-usage',
                  sessionsUsed: used,
                  limit: limit ?? undefined,
                },
              }))}
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
            >
              Upgrade for unlimited →
            </button>
          )}
        </>
      )}

      {isPremium && (
        <p className="text-xs text-emerald-400">Premium — unlimited sessions</p>
      )}
    </div>
  );
}