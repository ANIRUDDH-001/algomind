/**
 * @codesage
 * @file      src/hooks/useConceptHeatmap.ts
 * @purpose   Fetches and manages concept heatmap state for the knowledge graph.
 * @tech      React, Fetch API
 * @connects  Calls internal API endpoints; Exported for diagnostic and dashboard components
 * @apis      GET /api/knowledge/concepts
 * @db        none
 * @state     React component state for knowledge concepts and loading status
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { KGConceptSummary } from '@/lib/knowledge-graph';

interface UseConceptHeatmapOptions {
  autoRefresh?: boolean;
  refreshIntervalMs?: number;
}

interface UseConceptHeatmapResult {
  concepts: KGConceptSummary[];
  isLoading: boolean;
  error: string | null;
  hasCompletedDiagnostic: boolean;
  weakestConcept: KGConceptSummary | null;
  strongestConcept: KGConceptSummary | null;
  refresh: () => Promise<void>;
}

interface ConceptsResponse {
  concepts?: KGConceptSummary[];
  hasCompletedDiagnostic?: boolean;
}

export function useConceptHeatmap(options: UseConceptHeatmapOptions = {}): UseConceptHeatmapResult {
  const { autoRefresh = false, refreshIntervalMs = 30000 } = options;

  const [concepts, setConcepts] = useState<KGConceptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCompletedDiagnosticFromApi, setHasCompletedDiagnosticFromApi] = useState(false);

  const fetchConcepts = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/concepts');
      if (!res.ok) throw new Error('Failed to fetch concepts');
      const data = await res.json() as ConceptsResponse;
      setConcepts(data.concepts ?? []);
      setHasCompletedDiagnosticFromApi(Boolean(data.hasCompletedDiagnostic));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConcepts();

    if (autoRefresh) {
      const interval = setInterval(() => {
        void fetchConcepts();
      }, refreshIntervalMs);

      return () => clearInterval(interval);
    }

    return;
  }, [fetchConcepts, autoRefresh, refreshIntervalMs]);

  const withEvidence = concepts.filter((concept) => concept.evidenceCount > 0);
  const hasCompletedDiagnostic = hasCompletedDiagnosticFromApi || withEvidence.length > 0;

  const weakestConcept = withEvidence.length > 0
    ? [...withEvidence].sort((a, b) => a.confidence - b.confidence)[0] ?? null
    : null;

  const strongestConcept = withEvidence.length > 0
    ? [...withEvidence].sort((a, b) => b.confidence - a.confidence)[0] ?? null
    : null;

  return {
    concepts,
    isLoading,
    error,
    hasCompletedDiagnostic,
    weakestConcept,
    strongestConcept,
    refresh: fetchConcepts,
  };
}
