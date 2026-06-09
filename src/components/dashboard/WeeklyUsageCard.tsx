/**
 * @codesage
 * @component WeeklyUsageCard
 * @description Dashboard card showing weekly session usage.
 *              Replaces deprecated DailyQuestionsCard.
 * @phase Phase 2K
 */
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

interface WeeklyUsage {
  accountType: string;
  sessionsUsed: number;
  limit: number | null;
  sessionsRemaining: number | null;
  isUnlimited: boolean;
  allowed: boolean;
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

  const {
    sessionsUsed = 0,
    limit = null,
    sessionsRemaining = null,
    isUnlimited = false,
  } = data;

  const progressPct = isUnlimited
    ? 100
    : Math.min(100, ((sessionsUsed ?? 0) / (limit ?? 20)) * 100);

  return (
    <div className="rounded-2xl bg-[#111118] border border-[#1E1E2E] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">This Week</h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-black text-white tabular-nums">
              {isUnlimited ? (
                <span className="text-emerald-400 font-semibold text-xl">∞ Unlimited</span>
              ) : (
                <span>{sessionsUsed} / {limit ?? '—'}</span>
              )}
            </span>
          </div>
          <span className="text-xs text-zinc-500">
            sessions this week · interviews + learn
          </span>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isUnlimited ? 'bg-emerald-950/60 border border-emerald-500/20' : 'bg-zinc-900 border border-zinc-700/30'}`}>
          <Zap size={16} className={isUnlimited ? 'text-emerald-400' : 'text-zinc-400'} />
        </div>
      </div>

      {/* Progress bar */}
      {!isUnlimited && (
        <>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${progressPct >= 80 ? 'bg-red-500' : 'bg-indigo-500'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {sessionsRemaining === 0
              ? 'Limit reached — resets next Monday'
              : `${sessionsRemaining} session${sessionsRemaining !== 1 ? 's' : ''} remaining this week`
            }
          </p>
          {(sessionsRemaining ?? 0) === 0 && (
            <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1.5">
              <span>Resets Monday</span>
            </p>
          )}
        </>
      )}

      {isUnlimited && (
        <p className="text-xs text-emerald-400">Owner tier — unlimited sessions</p>
      )}
    </div>
  );
}