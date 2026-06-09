'use client';

import { Clock, RefreshCw } from 'lucide-react';

export interface LimitReachedBannerProps {
  used: number;
  limit: number | null;
  /** Day name when the limit resets. Defaults to 'Monday'. */
  resetDay?: string;
  className?: string;
}

/**
 * Shown when a user has exhausted their weekly session limit.
 * Purely informational — no upgrade CTA, no payment link.
 */
export function LimitReachedBanner({
  used,
  limit,
  resetDay = 'Monday',
  className = '',
}: LimitReachedBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'rounded-2xl border border-amber-500/20 bg-amber-500/5',
        'p-5 flex items-start gap-4',
        className,
      ].join(' ')}
    >
      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
        <Clock className="w-5 h-5 text-amber-400" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-amber-300 mb-1">
          Weekly limit reached
        </h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          You&apos;ve used{' '}
          <span className="text-white font-semibold">
            {used}
            {limit !== null ? `/${limit}` : ''} sessions
          </span>{' '}
          this week — interviews and learn sessions count together. Your
          limit resets every{' '}
          <span className="text-white font-semibold">{resetDay}</span>.
        </p>
        <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 shrink-0" aria-hidden="true" />
          No action needed — come back after the weekly reset.
        </p>
      </div>
    </div>
  );
}
