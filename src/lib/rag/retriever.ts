// Hybrid Retriever
// Combines semantic search with keyword fallback for robust retrieval

import { RetrievalResult, SearchResult } from './types';
import { getVectorStore, SimpleVectorStore } from './vectorStore';

export interface RetrieverOptions {
    topK?: number;
    semanticWeight?: number;
    minScore?: number;
    includeTopic?: string;
    includeDifficulty?: 'easy' | 'medium' | 'hard';
}

export class HybridRetriever {
    private vectorStore: SimpleVectorStore;
    private initialized: boolean = false;

    constructor(vectorStore?: SimpleVectorStore) {
        this.vectorStore = vectorStore || getVectorStore();
    }

    /**
     * Initialize the retriever by loading embeddings
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        await this.vectorStore.load();
        this.initialized = true;
    }

    /**
     * Retrieve relevant chunks for a query
     */
    async retrieve(query: string, options: RetrieverOptions = {}): Promise<RetrievalResult> {
        const startTime = Date.now();

        // Ensure initialized
        if (!this.initialized) {
            await this.initialize();
        }

        const {
            topK = 5,
            semanticWeight = 0.7,
            minScore = 0.1,
            includeTopic,
            includeDifficulty,
        } = options;

        let results: SearchResult[];

        try {
            // Try hybrid search first
            results = await this.vectorStore.hybridSearch(query, topK, semanticWeight);
        } catch (error) {
            console.warn('Semantic search failed, falling back to keyword search:', error);
            // Fall back to keyword search if embeddings fail
            results = this.vectorStore.keywordSearch(query, topK);
        }

        // Apply filters
        if (includeTopic) {
            results = results.filter(r => r.chunk.topic === includeTopic);
        }
        if (includeDifficulty) {
            results = results.filter(r => r.chunk.difficulty === includeDifficulty);
        }

        // Apply minimum score threshold
        results = results.filter(r => r.score >= minScore);

        // Limit to topK after filtering
        results = results.slice(0, topK);

        const endTime = Date.now();

        return {
            query,
            results,
            totalResults: results.length,
            retrievalTimeMs: endTime - startTime,
            modelsUsed: {
                embedding: 'gemini-embedding-2', // text-embedding-004 shut down Jan 14 2026 → migrated to gemini-embedding-2
            },
        };
    }

    /**
     * Get context string for RAG prompt
     */
    async getContext(query: string, options: RetrieverOptions = {}): Promise<string> {
        const result = await this.retrieve(query, options);

        if (result.results.length === 0) {
            return 'No relevant context found.';
        }

        const contextParts = result.results.map((r, i) => {
            const chunk = r.chunk;
            let context = `[${i + 1}] ${chunk.title} (${chunk.topic}/${chunk.subtopic})\n`;
            context += `Difficulty: ${chunk.difficulty}\n`;
            context += chunk.content;
            if (chunk.timeComplexity) {
                context += `\nTime Complexity: ${chunk.timeComplexity}`;
            }
            if (chunk.spaceComplexity) {
                context += `\nSpace Complexity: ${chunk.spaceComplexity}`;
            }
            return context;
        });

        return contextParts.join('\n\n---\n\n');
    }

    /**
     * Check if retriever is ready
     */
    isReady(): boolean {
        return this.initialized && this.vectorStore.size() > 0;
    }

    /**
     * Get statistics
     */
    getStats(): { totalChunks: number; isReady: boolean } {
        return {
            totalChunks: this.vectorStore.size(),
            isReady: this.isReady(),
        };
    }
}

// Singleton instance
let retrieverInstance: HybridRetriever | null = null;

export function getRetriever(): HybridRetriever {
    if (!retrieverInstance) {
        retrieverInstance = new HybridRetriever();
    }
    return retrieverInstance;
}

// Convenience function
export async function retrieveContext(
    query: string,
    options?: RetrieverOptions
): Promise<string> {
    const retriever = getRetriever();
    return retriever.getContext(query, options);
}
