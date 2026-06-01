/**
 * @codesage
 * @component KnowledgeInsightsCard
 * @description Dashboard card showing concept heatmap + weekly progress.
 * @phase Phase 2K
 */
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ConceptHeatmap } from '@/components/knowledge/ConceptHeatmap';

export function KnowledgeInsightsCard() {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-2xl bg-[#111118] border border-[#1E1E2E] overflow-hidden" data-tour="cognitive-profile">
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Knowledge Map</span>
          <span className="text-xs text-zinc-500">20 DSA concepts</span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-zinc-500" />
        ) : (
          <ChevronDown size={16} className="text-zinc-500" />
        )}
      </button>

      {/* Heatmap */}
      {expanded && (
        <div className="px-5 pb-5">
          <ConceptHeatmap className="mt-0" />
        </div>
      )}
    </div>
  );
}