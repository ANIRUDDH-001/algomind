/**
 * @component ConceptHeatmap
 * @description 20-tile concept knowledge visualization.
 *              Primary dashboard insight component for AlgoMind 2.0.
 *              Replaces skills radar as the main progress view.
 * @phase Phase 2I
 */
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ConceptTile } from './ConceptTile';
import { ConceptDetailPanel } from './ConceptDetailPanel';
import { useConceptHeatmap } from '@/hooks/useConceptHeatmap';
import { CONCEPT_CONFIDENCE_COLORS } from '@/types/knowledge-graph';
import type { KGConceptSummary } from '@/lib/knowledge-graph';

interface ConceptHeatmapProps {
  activeLearningConceptSlug?: string;
  className?: string;
}

export function ConceptHeatmap({ activeLearningConceptSlug, className = '' }: ConceptHeatmapProps) {
  const router = useRouter();
  const { concepts, isLoading, error, hasCompletedDiagnostic, weakestConcept } = useConceptHeatmap();
  const [selectedConcept, setSelectedConcept] = useState<KGConceptSummary | null>(null);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={`concept-skeleton-${i}`}
              data-testid="concept-heatmap-skeleton"
              className="h-[72px] rounded-xl bg-zinc-900/40 animate-pulse"
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className={`flex items-center gap-2 p-4 rounded-xl bg-red-950/20 border border-red-500/20 ${className}`}>
        <AlertCircle size={16} className="text-red-400" />
        <p className="text-sm text-red-300">Could not load concept data</p>
      </div>
    );
  }

    return (
      <div data-testid="concept-heatmap" className={className}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-400" />
              Knowledge Map
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {hasCompletedDiagnostic
                ? `${concepts.filter((c) => c.evidenceCount > 0).length}/20 concepts tracked`
                : 'Complete the diagnostic to start tracking'}
            </p>
          </div>

        {!hasCompletedDiagnostic && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/learn/diagnostic')}
            className="self-start sm:self-auto text-xs font-medium text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 hover:border-indigo-500/40 transition-all whitespace-nowrap"
          >
            Take Diagnostic -&gt;
          </motion.button>
        )}

        {hasCompletedDiagnostic && weakestConcept && (
          <button
            type="button"
            onClick={() => setSelectedConcept(weakestConcept)}
            className="self-start sm:self-auto text-xs text-red-400 hover:text-red-300 flex items-center gap-1 whitespace-nowrap"
          >
            Focus: {weakestConcept.displayName} -&gt;
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap gap-y-1.5">
        {[
          { level: 'unknown', label: 'Not assessed' },
          { level: 'weak', label: 'Weak' },
          { level: 'developing', label: 'Developing' },
          { level: 'solid', label: 'Solid' },
          { level: 'strong', label: 'Strong' },
        ].map((item) => (
          <div key={item.level} className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CONCEPT_CONFIDENCE_COLORS[item.level as keyof typeof CONCEPT_CONFIDENCE_COLORS] }}
            />
            <span className="text-xs text-zinc-500">{item.label}</span>
          </div>
        ))}
      </div>

      <div data-testid="concept-heatmap-grid" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {concepts.map((concept, index) => (
          <ConceptTile
            key={concept.slug}
            concept={concept}
            index={index}
            isSelected={selectedConcept?.slug === concept.slug}
            isActiveLearning={activeLearningConceptSlug === concept.slug}
            onClick={setSelectedConcept}
          />
        ))}
      </div>

      <ConceptDetailPanel
        concept={selectedConcept}
        onClose={() => setSelectedConcept(null)}
      />

      {selectedConcept && (
        <div
          data-testid="heatmap-backdrop"
          className="fixed inset-0 z-30"
          onClick={() => setSelectedConcept(null)}
        />
      )}
    </div>
  );
}

// Storybook-ish compatibility for existing patterns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(ConceptHeatmap as any).__defaultProps = {
  activeLearningConceptSlug: undefined,
  className: '',
};
