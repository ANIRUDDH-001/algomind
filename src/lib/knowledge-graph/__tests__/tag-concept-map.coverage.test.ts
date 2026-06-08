import { describe, it, expect } from 'vitest';
import { PROBLEM_TAG_TO_CONCEPT_SLUG, INTENTIONALLY_UNMAPPED_TAGS } from '../tag-concept-map';

// This is the authoritative list of tags from the DB.
// Update this array whenever new tags are added to the problems table.
// Run: SELECT DISTINCT unnest(tags) FROM problems ORDER BY 1;
const ALL_DB_TAGS = [
    'Anagram', 'array', 'Array', 'Arrays', 'backtracking', 'Backtracking', 'BFS', 
    'Binary', 'Binary Search', 'Binary Search Tree', 'binary-indexed-tree', 
    'binary-search', 'binary-search-tree', 'binary-tree', 'Bit Manipulation', 
    'bit-manipulation', 'Blind 75', 'Boyer-Moore Majority Vote', 'brainteaser', 
    'Breadth-First Search', 'breadth-first-search', 'bucket-sort', 'combinatorics', 
    'Constant Time Complexity', 'counting', 'Data Stream', 'Data Structures', 
    'data-stream', 'Depth-First Search', 'depth-first-search', 'design', 'Design', 
    'DFS', 'Dijkstra\'s Algorithm', 'divide-and-conquer', 'Doubly Linked List', 'DP', 
    'Dutch National Flag Algorithm', 'Dynamic Programming', 'dynamic-programming', 
    'Floyd-Warshall Algorithm', 'Floyd\'s Tortoise and Hare', 'game-theory', 'GCD', 
    'Geometry', 'graph', 'Graph', 'greedy', 'Greedy', 'Grid', 'Grind 75', 'Hash Map', 
    'Hash Table', 'hash-table', 'Hashmap', 'HashMap', 'HashSet', 'heap', 'Heap', 
    'Heap (Priority Queue)', 'Kadane\'s Algorithm', 'Linked List', 'linked-list', 
    'Linked-List', 'List Comprehension', 'LRU Cache', 'math', 'Math', 'matrix', 'Matrix', 
    'Median', 'memoization', 'merge-sort', 'monotonic-queue', 'monotonic-stack', 
    'NeetCode 150', 'ordered-set', 'Prefix Sum', 'Prefix XOR', 'prefix-sum', 
    'Priority Queue', 'Probability', 'queue', 'quickselect', 'Random', 
    'Ratio Optimization', 'recursion', 'Recursion', 'Rejection Sampling', 'segment-tree', 
    'Set', 'Shortest Path', 'simulation', 'Simulation', 'Sliding Window', 'sliding-window', 
    'sorting', 'Sorting', 'stack', 'Stack', 'State Machine', 'string', 'String', 
    'String Matching', 'string-matching', 'Striver A-Z', 'Striver\'s A-Z DSA Sheet', 
    'Topological Sort', 'topological-sort', 'tree', 'Tree', 'trie', 'Trie', 'Two Pointers', 
    'two-pointers', 'Union Find', 'union-find'
];

describe('Tag-to-concept-slug map coverage', () => {
    it('every DB tag is either mapped to a concept or explicitly unmapped', () => {
        const unmappedTags = ALL_DB_TAGS.filter(tag =>
            !(tag.toLowerCase() in PROBLEM_TAG_TO_CONCEPT_SLUG) &&
            !INTENTIONALLY_UNMAPPED_TAGS.has(tag.toLowerCase())
        );

        if (unmappedTags.length > 0) {
            throw new Error(
                `The following problem tags have no KG mapping and are not in INTENTIONALLY_UNMAPPED_TAGS:\n` +
                unmappedTags.map(t => `  - '${t}'`).join('\n') + '\n' +
                `Either add them to PROBLEM_TAG_TO_CONCEPT_SLUG or to INTENTIONALLY_UNMAPPED_TAGS.`
            );
        }
    });

    it('all concept slugs in the map are valid (non-null values match known concepts)', () => {
        const KNOWN_CONCEPT_SLUGS = new Set([
            'arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window', 
            'binary-search', 'recursion-backtracking', 'trees-traversal', 
            'graphs-bfs-dfs', 'dynamic-programming', 'heaps', 'tries', 
            'sorting-algorithms', 'linked-lists', 'bit-manipulation', 
            'math-number-theory', 'stack-queue', 'intervals', 'matrix', 
            'prefix-sum', 'union-find'
        ]);

        for (const [tag, slug] of Object.entries(PROBLEM_TAG_TO_CONCEPT_SLUG)) {
            if (slug !== null && !KNOWN_CONCEPT_SLUGS.has(slug)) {
                throw new Error(
                    `Tag '${tag}' maps to unknown concept slug '${slug}'. ` +
                    `Check concept_tags table for valid slugs.`
                );
            }
        }
    });
});
