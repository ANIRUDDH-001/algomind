/**
 * Test utilities for knowledge graph tests.
 * Reusable mock factories.
 */
// @ts-nocheck

// 

import type { KGConceptState, KGConceptSummary } from '@/lib/knowledge-graph';

export function buildMockConceptState(overrides: Partial<KGConceptState> = {}): KGConceptState {
  return {
    id: 'state-1',
    userId: 'user-1',
    conceptSlug: 'arrays-strings',
    confidence: 0.5,
    evidenceCount: 3,
    signalHistory: [],
    lastSessionId: null,
    lastSessionType: null,
    lastSignalAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildMockConceptSummary(overrides: Partial<KGConceptSummary> = {}): KGConceptSummary {
  return {
    slug: 'arrays-strings',
    displayName: 'Arrays & Strings',
    confidence: 0.5,
    evidenceCount: 0,
    level: 'unknown',
    icon: '[]',
    lastSessionType: null,
    lastSignalAt: null,
    ...overrides,
  };
}

export function buildMockConceptSummaries(count = 20): KGConceptSummary[] {
  const slugs = [
    'arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window',
    'binary-search', 'recursion-backtracking', 'trees-traversal', 'graphs-bfs-dfs',
    'dynamic-programming', 'heaps', 'tries', 'sorting-algorithms', 'linked-lists',
    'bit-manipulation', 'math-number-theory', 'stack-queue', 'intervals',
    'matrix', 'prefix-sum', 'union-find',
  ];

  return slugs.slice(0, count).map((slug, i) =>
    buildMockConceptSummary({
      slug,
      displayName: slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      confidence: 0.3 + i * 0.025,
      evidenceCount: i > 10 ? 0 : i + 1,
      level: i < 5 ? 'weak' : i < 12 ? 'developing' : 'solid',
    })
  );
}
