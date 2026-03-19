/**
 * @component ConceptImpactBadge
 * @description Shows which concepts were impacted by an interview session.
 *              Displayed in analysis results after session completion.
 * @phase Phase 2M
 */
'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface ConceptImpact {
  slug: string;
  displayName: string;
  delta: number;
  confidenceAfter: number;
}

interface ConceptImpactBadgeProps {
  impacts: ConceptImpact[];
}

export function ConceptImpactBadge({ impacts }: ConceptImpactBadgeProps) {
  if (!impacts || impacts.length === 0) return null;

  return (
    <div className="space-y-1" data-testid="concept-impact-badge">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Concept Impact</p>
      <div className="flex flex-wrap gap-2">
        {impacts.map((impact, i) => (
          <motion.div
            key={impact.slug}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
              ${impact.delta > 0.01
                ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400'
                : impact.delta < -0.01
                  ? 'bg-red-950/40 border border-red-500/20 text-red-400'
                  : 'bg-zinc-900/60 border border-zinc-700/30 text-zinc-400'
              }
            `}
          >
            {impact.delta > 0.01 ? (
              <TrendingUp size={10} />
            ) : impact.delta < -0.01 ? (
              <TrendingDown size={10} />
            ) : (
              <Minus size={10} />
            )}
            <span>{impact.displayName}</span>
            <span className="tabular-nums opacity-70">
              {impact.delta > 0 ? '+' : ''}{Math.round(impact.delta * 100)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
