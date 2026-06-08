/**
 * Common DSA interview questions for cache pre-warming.
 *
 * These are the most frequently asked questions in coding interviews,
 * pre-loaded on app start for instant response when the cache feature is enabled.
 *
 * @module common-questions
 */
// @ts-nocheck


export interface CommonQuestion {
    /** The question text */
    query: string;
    /** Expected complexity classification */
    complexity: 'simple' | 'medium' | 'complex';
    /** Topic category */
    topic: string;
}

export const COMMON_QUESTIONS: CommonQuestion[] = [
    // ── Greetings & Meta (simple) ──────────────────────────────────
    { query: 'Hello', complexity: 'simple', topic: 'greeting' },
    { query: 'Hi, I am ready for the interview', complexity: 'simple', topic: 'greeting' },
    { query: 'Can we start?', complexity: 'simple', topic: 'greeting' },
    { query: 'Thank you', complexity: 'simple', topic: 'greeting' },
    { query: 'Can you repeat that?', complexity: 'simple', topic: 'clarification' },

    // ── Data Structures (medium → complex) ─────────────────────────
    { query: 'What is an array?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a linked list?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a hash table?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a stack?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a queue?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a binary tree?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a heap?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a graph?', complexity: 'medium', topic: 'data-structures' },
    { query: 'What is a trie?', complexity: 'medium', topic: 'data-structures' },
    { query: 'Difference between array and linked list', complexity: 'complex', topic: 'data-structures' },
    { query: 'When should I use a hash map vs a tree map?', complexity: 'complex', topic: 'data-structures' },

    // ── Algorithms (complex) ───────────────────────────────────────
    { query: 'Explain binary search', complexity: 'complex', topic: 'algorithms' },
    { query: 'How does merge sort work?', complexity: 'complex', topic: 'algorithms' },
    { query: 'Explain quicksort algorithm', complexity: 'complex', topic: 'algorithms' },
    { query: 'What is dynamic programming?', complexity: 'complex', topic: 'algorithms' },
    { query: 'Explain BFS and DFS', complexity: 'complex', topic: 'algorithms' },
    { query: 'What is a greedy algorithm?', complexity: 'complex', topic: 'algorithms' },
    { query: 'What is backtracking?', complexity: 'complex', topic: 'algorithms' },
    { query: 'Explain Dijkstra algorithm', complexity: 'complex', topic: 'algorithms' },
    { query: 'How does a sliding window technique work?', complexity: 'complex', topic: 'algorithms' },
    { query: 'Explain two pointer technique', complexity: 'complex', topic: 'algorithms' },

    // ── Time & Space Complexity (medium → complex) ─────────────────
    { query: 'What is Big O notation?', complexity: 'medium', topic: 'complexity' },
    { query: 'What is the time complexity of binary search?', complexity: 'complex', topic: 'complexity' },
    { query: 'What is O(n log n)?', complexity: 'medium', topic: 'complexity' },
    { query: 'What is space complexity?', complexity: 'medium', topic: 'complexity' },
    { query: 'Compare time complexity of different sorting algorithms', complexity: 'complex', topic: 'complexity' },

    // ── Common Problems (complex) ──────────────────────────────────
    { query: 'How do you reverse a linked list?', complexity: 'complex', topic: 'problems' },
    { query: 'Find the maximum subarray sum', complexity: 'complex', topic: 'problems' },
    { query: 'How to detect a cycle in a linked list?', complexity: 'complex', topic: 'problems' },
    { query: 'Implement a LRU cache', complexity: 'complex', topic: 'problems' },
    { query: 'Two sum problem', complexity: 'complex', topic: 'problems' },
    { query: 'How to find duplicates in an array?', complexity: 'complex', topic: 'problems' },
    { query: 'Validate a binary search tree', complexity: 'complex', topic: 'problems' },
    { query: 'Merge two sorted arrays', complexity: 'complex', topic: 'problems' },
    { query: 'Find the longest common subsequence', complexity: 'complex', topic: 'problems' },
    { query: 'How to balance a binary tree?', complexity: 'complex', topic: 'problems' },

    // ── System Design (complex) ────────────────────────────────────
    { query: 'How would you design a URL shortener?', complexity: 'complex', topic: 'system-design' },
    { query: 'Design a rate limiter', complexity: 'complex', topic: 'system-design' },
    { query: 'How would you design a chat application?', complexity: 'complex', topic: 'system-design' },

    // ── Behavioral (complex) ───────────────────────────────────────
    { query: 'Tell me about a time you solved a difficult bug', complexity: 'complex', topic: 'behavioral' },
    { query: 'How do you handle disagreements with teammates?', complexity: 'complex', topic: 'behavioral' },

    // ── General CS Concepts (medium) ───────────────────────────────
    { query: 'What is recursion?', complexity: 'medium', topic: 'concepts' },
    { query: 'What is memoization?', complexity: 'medium', topic: 'concepts' },
    { query: 'Explain the difference between iteration and recursion', complexity: 'medium', topic: 'concepts' },
    { query: 'What are immutable data structures?', complexity: 'medium', topic: 'concepts' },
    { query: 'What is a deadlock?', complexity: 'medium', topic: 'concepts' },
];

/** Get queries suitable for pre-warming (just the query strings). */
export function getPreWarmQueries(): string[] {
    return COMMON_QUESTIONS.map(q => q.query);
}

/** Get the top N highest-priority queries for pre-warming. */
export function getTopPreWarmQueries(n = 20): string[] {
    // Prioritise simple/medium (likely to be asked first in interviews)
    const sorted = [...COMMON_QUESTIONS].sort((a, b) => {
        const order = { simple: 0, medium: 1, complex: 2 };
        return order[a.complexity] - order[b.complexity];
    });
    return sorted.slice(0, n).map(q => q.query);
}
