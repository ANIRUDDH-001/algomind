/**
 * @component ConceptTile
 * @description Single tile in the concept heatmap.
 *              Color-coded by confidence level. Click to open detail panel.
 * @phase Phase 2I
 * @a11y Phase 3E — forwardRef, aria-label, aria-pressed, useReducedMotion
 */
'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { KGConceptSummary } from '@/lib/knowledge-graph';
import type { ConceptConfidenceLevel } from '@/types/knowledge-graph';

const CONFIDENCE_COLORS: Record<ConceptConfidenceLevel, { bg: string; border: string; text: string; bar: string }> = {
  unknown: { bg: 'bg-zinc-900/60', border: 'border-zinc-700/30', text: 'text-zinc-500', bar: 'bg-zinc-700' },
  weak: { bg: 'bg-red-950/40', border: 'border-red-500/30', text: 'text-red-400', bar: 'bg-red-500' },
  developing: { bg: 'bg-amber-950/30', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' },
  solid: { bg: 'bg-blue-950/30', border: 'border-blue-500/30', text: 'text-blue-400', bar: 'bg-blue-500' },
  strong: { bg: 'bg-emerald-950/30', border: 'border-emerald-500/30', text: 'text-emerald-400', bar: 'bg-emerald-500' },
};

interface ConceptTileProps {
  concept: KGConceptSummary;
  index: number;
  isSelected?: boolean;
  isActiveLearning?: boolean;
  onClick?: (concept: KGConceptSummary) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const ConceptTile = React.forwardRef<HTMLButtonElement, ConceptTileProps>(
  ({ concept, index, isSelected, isActiveLearning, onClick, onKeyDown }, ref) => {
    const colors = CONFIDENCE_COLORS[concept.level] ?? CONFIDENCE_COLORS.unknown;
    const pct = Math.round(concept.confidence * 100);
    const prefersReducedMotion = useReducedMotion();

    // Build descriptive aria-label
    const ariaLabel = concept.evidenceCount > 0
      ? `${concept.displayName}: ${pct}% confidence, ${concept.level} level`
      : `${concept.displayName}: not yet assessed, ${concept.level} level`;

    return (
      <motion.button
        ref={ref}
        data-testid="concept-tile"
        data-concept-name={concept.displayName}
        data-concept-slug={concept.slug}
        initial={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.03, duration: 0.35, ease: 'easeOut' }}
        whileHover={prefersReducedMotion ? {} : { scale: 1.02, transition: { duration: 0.15 } }}
        whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
        onClick={() => onClick?.(concept)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        aria-pressed={isSelected ?? false}
        aria-describedby={`tile-desc-${concept.slug}`}
        className={[
          'relative w-full text-left rounded-xl border p-3 transition-all',
          colors.bg,
          colors.border,
          isSelected ? 'ring-2 ring-indigo-500/60 ring-offset-1 ring-offset-[#0A0A0F]' : '',
          isActiveLearning ? 'ring-2 ring-emerald-500/60 ring-offset-1 ring-offset-[#0A0A0F]' : '',
          'hover:border-opacity-60 hover:shadow-lg hover:shadow-black/20',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500/60',
        ].join(' ')}
        title={`${concept.displayName}: ${pct}% confidence`}
      >
        {isActiveLearning && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-emerald-500/5"
            animate={prefersReducedMotion ? { opacity: 0.5 } : { opacity: [0.3, 0.7, 0.3] }}
            transition={prefersReducedMotion ? {} : { duration: 2, repeat: Infinity }}
          />
        )}

        <div className="relative">
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg leading-none flex-shrink-0">{concept.icon}</span>
            <span className={`text-xs font-semibold leading-tight line-clamp-2 ${colors.text}`}>
              {concept.displayName}
            </span>
          </div>

          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
            <motion.div
              className={`h-full rounded-full ${colors.bar}`}
              initial={{ width: 0 }}
              animate={{ width: concept.evidenceCount > 0 ? `${pct}%` : '0%' }}
              transition={prefersReducedMotion ? { duration: 0 } : { delay: index * 0.03 + 0.2, duration: 0.6, ease: 'easeOut' }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className={`text-xs tabular-nums ${concept.evidenceCount > 0 ? colors.text : 'text-zinc-600'}`}>
              {concept.evidenceCount > 0 ? `${pct}%` : '-'}
            </span>
            {concept.evidenceCount > 0 && (
              <span className="text-xs text-zinc-500">
                {concept.evidenceCount} signal{concept.evidenceCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Hidden description for screen readers */}
        <span id={`tile-desc-${concept.slug}`} className="sr-only">
          {concept.evidenceCount > 0
            ? `Based on ${concept.evidenceCount} session signals. Last session: ${concept.lastSessionType ?? 'none'}.`
            : 'No sessions completed for this concept yet.'}
        </span>
      </motion.button>
    );
  }
);
ConceptTile.displayName = 'ConceptTile';
