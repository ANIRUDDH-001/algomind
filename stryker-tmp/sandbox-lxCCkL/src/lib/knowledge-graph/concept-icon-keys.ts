// @ts-nocheck
import type { DSAConceptSlug } from '@/types/knowledge-graph';

export type ConceptIconKey =
  | 'code'
  | 'search'
  | 'brain'
  | 'database'
  | 'activity'
  | 'chart'
  | 'book'
  | 'target'
  | 'clock'
  | 'layout';

const CONCEPT_ICON_KEY_BY_SLUG: Record<DSAConceptSlug, ConceptIconKey> = {
  'arrays-strings': 'code',
  'hashmaps-sets': 'database',
  'two-pointers': 'target',
  'sliding-window': 'activity',
  'binary-search': 'search',
  'recursion-backtracking': 'brain',
  'trees-traversal': 'book',
  'graphs-bfs-dfs': 'layout',
  'dynamic-programming': 'brain',
  heaps: 'chart',
  tries: 'book',
  'sorting-algorithms': 'chart',
  'linked-lists': 'layout',
  'bit-manipulation': 'activity',
  'math-number-theory': 'clock',
  'stack-queue': 'database',
  intervals: 'target',
  matrix: 'layout',
  'prefix-sum': 'chart',
  'union-find': 'search',
};

export function getConceptIconKey(slug: string): ConceptIconKey {
  return CONCEPT_ICON_KEY_BY_SLUG[slug as DSAConceptSlug] ?? 'book';
}
