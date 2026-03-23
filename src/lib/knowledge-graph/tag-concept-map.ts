/**
 * @module knowledge-graph/tag-concept-map
 * @description Maps problem.tags[] and problem.primary_pattern values to
 *              DSA concept slugs used in concept_states.
 *              Single source of truth — imported by KG service and AnalysisClient.
 */

export const PROBLEM_TAG_TO_CONCEPT_SLUG: Record<string, string> = {
  arrays: 'arrays-strings',
  strings: 'arrays-strings',
  hashing: 'hashmaps-sets',
  hashmap: 'hashmaps-sets',
  'two-pointer': 'two-pointers',
  'two-pointers': 'two-pointers',
  'sliding-window': 'sliding-window',
  'binary-search': 'binary-search',
  recursion: 'recursion-backtracking',
  backtracking: 'recursion-backtracking',
  trees: 'trees-traversal',
  tree: 'trees-traversal',
  traversal: 'trees-traversal',
  graphs: 'graphs-bfs-dfs',
  graph: 'graphs-bfs-dfs',
  bfs: 'graphs-bfs-dfs',
  dfs: 'graphs-bfs-dfs',
  'dynamic-programming': 'dynamic-programming',
  dp: 'dynamic-programming',
  memoization: 'dynamic-programming',
  tabulation: 'dynamic-programming',
  heap: 'heaps',
  heaps: 'heaps',
  'priority-queue': 'heaps',
  trie: 'tries',
  tries: 'tries',
  sorting: 'sorting-algorithms',
  sort: 'sorting-algorithms',
  'linked-list': 'linked-lists',
  'linked-lists': 'linked-lists',
  'bit-manipulation': 'bit-manipulation',
  bits: 'bit-manipulation',
  math: 'math-number-theory',
  'number-theory': 'math-number-theory',
  stack: 'stack-queue',
  queue: 'stack-queue',
  intervals: 'intervals',
  matrix: 'matrix',
  'prefix-sum': 'prefix-sum',
  'union-find': 'union-find',
  'disjoint-set': 'union-find',
};

export function tagsToConceptSlugs(tags: string[], primaryPattern?: string | null): string[] {
  const combined = primaryPattern ? [...tags, primaryPattern] : tags;
  const mapped = combined
    .map((tag) => PROBLEM_TAG_TO_CONCEPT_SLUG[tag])
    .filter((slug): slug is string => slug !== undefined);
  return [...new Set(mapped)];
}

export function tagsToFirstConceptSlug(tags: string[], primaryPattern?: string | null): string | null {
  const slugs = tagsToConceptSlugs(tags, primaryPattern);
  return slugs[0] ?? null;
}
