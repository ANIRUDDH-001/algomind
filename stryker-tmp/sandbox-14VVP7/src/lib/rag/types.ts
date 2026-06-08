// @ts-nocheck
// RAG Pipeline Type Definitions
// Types for knowledge chunks, embeddings, and retrieval results

export interface KnowledgeChunk {
    id: string;
    topic: string;           // e.g., "arrays", "trees", "dp"
    subtopic: string;        // e.g., "two-pointer", "bfs", "memoization"
    title: string;           // Display title
    content: string;         // The actual text content
    keywords: string[];      // For keyword fallback search
    difficulty: 'easy' | 'medium' | 'hard';
    patterns: string[];      // Related DSA patterns (sliding-window, etc.)
    codeExamples?: string[]; // Optional code snippets
    timeComplexity?: string; // e.g., "O(n)"
    spaceComplexity?: string; // e.g., "O(1)"
}

export interface EmbeddedChunk extends KnowledgeChunk {
    embedding: number[];     // Vector embedding
    embeddingModel: string;  // Model used to generate embedding
}

export interface SearchResult {
    chunk: KnowledgeChunk;
    score: number;           // Similarity score (0-1)
    matchType: 'semantic' | 'keyword' | 'hybrid';
}

export interface RetrievalResult {
    query: string;
    results: SearchResult[];
    totalResults: number;
    retrievalTimeMs: number;
    modelsUsed: {
        embedding?: string;
        reranking?: string;
    };
}

export interface IngestionResult {
    totalChunks: number;
    successfulEmbeddings: number;
    failedEmbeddings: number;
    timeMs: number;
    errors: string[];
}

// Topic categories for DSA knowledge
export const DSA_TOPICS = [
    'arrays',
    'strings',
    'linked-lists',
    'stacks',
    'queues',
    'trees',
    'graphs',
    'heaps',
    'hash-tables',
    'dynamic-programming',
    'greedy',
    'backtracking',
    'sorting',
    'searching',
    'bit-manipulation',
    'math',
    'two-pointers',
    'sliding-window',
    'recursion',
] as const;

export type DSATopic = typeof DSA_TOPICS[number];

// Common DSA patterns
export const DSA_PATTERNS = [
    'two-pointers',
    'sliding-window',
    'fast-slow-pointers',
    'merge-intervals',
    'cyclic-sort',
    'in-place-reversal',
    'bfs',
    'dfs',
    'binary-search',
    'top-k-elements',
    'k-way-merge',
    'topological-sort',
    'union-find',
    'memoization',
    'tabulation',
    'divide-and-conquer',
    'greedy-choice',
    'backtracking',
    'monotonic-stack',
    'trie',
] as const;

export type DSAPattern = typeof DSA_PATTERNS[number];
