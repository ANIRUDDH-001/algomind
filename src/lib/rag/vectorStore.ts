// JSON-based Vector Store
// Simple, file-based vector storage for RAG pipeline

import { promises as fs } from 'fs';
import path from 'path';
import { EmbeddedChunk, KnowledgeChunk, SearchResult } from './types';
import { embed } from '../ai/client';

// Cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// Simple keyword extraction
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
        'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where', 'why',
        'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
        'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
        'too', 'very', 'just', 'also', 'now', 'here', 'there', 'this', 'that',
        'these', 'those', 'it', 'its', 'we', 'us', 'our', 'you', 'your',
        'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'whose',
    ]);

    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word))
        .filter((word, index, arr) => arr.indexOf(word) === index); // unique
}

// Keyword match score using Jaccard similarity
function keywordMatchScore(queryKeywords: string[], chunkKeywords: string[]): number {
    const querySet = new Set(queryKeywords);
    const chunkSet = new Set(chunkKeywords);

    let intersection = 0;
    for (const word of querySet) {
        if (chunkSet.has(word)) intersection++;
    }

    const union = querySet.size + chunkSet.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

export class SimpleVectorStore {
    private chunks: EmbeddedChunk[] = [];
    private readonly dataDir: string;

    constructor(dataDir?: string) {
        this.dataDir = dataDir || path.join(process.cwd(), 'src', 'data', 'dsa-knowledge');
    }

    /**
     * Add a chunk with embedding
     */
    async add(chunk: KnowledgeChunk): Promise<void> {
        // Generate embedding
        const result = await embed(chunk.content);

        const embeddedChunk: EmbeddedChunk = {
            ...chunk,
            embedding: result.embeddings[0],
            embeddingModel: result.modelUsed,
        };

        this.chunks.push(embeddedChunk);
    }

    /**
     * Add a chunk with pre-computed embedding
     */
    addWithEmbedding(chunk: EmbeddedChunk): void {
        this.chunks.push(chunk);
    }

    /**
     * Semantic search using vector similarity
     */
    async semanticSearch(query: string, topK: number = 5): Promise<SearchResult[]> {
        if (this.chunks.length === 0) {
            return [];
        }

        // Get query embedding
        const result = await embed(query);
        const queryEmbedding = result.embeddings[0];

        // Calculate similarities
        const scored = this.chunks.map(chunk => ({
            chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding),
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        // Return top K
        return scored.slice(0, topK).map(item => ({
            chunk: item.chunk,
            score: item.score,
            matchType: 'semantic' as const,
        }));
    }

    /**
     * Keyword-based search (fallback)
     */
    keywordSearch(query: string, topK: number = 5): SearchResult[] {
        if (this.chunks.length === 0) {
            return [];
        }

        const queryKeywords = extractKeywords(query);

        // Score chunks by keyword overlap
        const scored = this.chunks.map(chunk => ({
            chunk,
            score: keywordMatchScore(queryKeywords, chunk.keywords),
        }));

        // Filter out zero scores and sort
        const filtered = scored.filter(item => item.score > 0);
        filtered.sort((a, b) => b.score - a.score);

        return filtered.slice(0, topK).map(item => ({
            chunk: item.chunk,
            score: item.score,
            matchType: 'keyword' as const,
        }));
    }

    /**
     * Hybrid search combining semantic and keyword
     */
    async hybridSearch(
        query: string,
        topK: number = 5,
        semanticWeight: number = 0.7
    ): Promise<SearchResult[]> {
        // Run both searches
        const [semanticResults, keywordResults] = await Promise.all([
            this.semanticSearch(query, topK * 2),
            Promise.resolve(this.keywordSearch(query, topK * 2)),
        ]);

        // Merge and rerank
        const scoreMap = new Map<string, { chunk: KnowledgeChunk; semanticScore: number; keywordScore: number }>();

        for (const result of semanticResults) {
            scoreMap.set(result.chunk.id, {
                chunk: result.chunk,
                semanticScore: result.score,
                keywordScore: 0,
            });
        }

        for (const result of keywordResults) {
            const existing = scoreMap.get(result.chunk.id);
            if (existing) {
                existing.keywordScore = result.score;
            } else {
                scoreMap.set(result.chunk.id, {
                    chunk: result.chunk,
                    semanticScore: 0,
                    keywordScore: result.score,
                });
            }
        }

        // Calculate hybrid scores
        const hybridResults: SearchResult[] = [];
        for (const [, item] of scoreMap) {
            const hybridScore =
                item.semanticScore * semanticWeight +
                item.keywordScore * (1 - semanticWeight);

            hybridResults.push({
                chunk: item.chunk,
                score: hybridScore,
                matchType: 'hybrid',
            });
        }

        // Sort and return top K
        hybridResults.sort((a, b) => b.score - a.score);
        return hybridResults.slice(0, topK);
    }

    /**
     * Save store to JSON file
     */
    async save(filename: string = 'embeddings.json'): Promise<void> {
        const filePath = path.join(this.dataDir, 'embeddings', filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(this.chunks, null, 2));
    }

    /**
     * Load store from JSON file
     */
    async load(filename: string = 'embeddings.json'): Promise<void> {
        const filePath = path.join(this.dataDir, 'embeddings', filename);
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            this.chunks = JSON.parse(data);
        } catch {
            console.warn(`No embeddings file found at ${filePath}. Starting fresh.`);
            this.chunks = [];
        }
    }

    /**
     * Get all chunks
     */
    getAllChunks(): EmbeddedChunk[] {
        return [...this.chunks];
    }

    /**
     * Get chunk count
     */
    size(): number {
        return this.chunks.length;
    }

    /**
     * Clear all chunks
     */
    clear(): void {
        this.chunks = [];
    }

    /**
     * Get chunks by topic
     */
    getByTopic(topic: string): EmbeddedChunk[] {
        return this.chunks.filter(chunk => chunk.topic === topic);
    }

    /**
     * Get chunks by difficulty
     */
    getByDifficulty(difficulty: 'easy' | 'medium' | 'hard'): EmbeddedChunk[] {
        return this.chunks.filter(chunk => chunk.difficulty === difficulty);
    }
}

// Singleton instance
let storeInstance: SimpleVectorStore | null = null;

export function getVectorStore(): SimpleVectorStore {
    if (!storeInstance) {
        storeInstance = new SimpleVectorStore();
    }
    return storeInstance;
}

// Helper to extract keywords (exported for use elsewhere)
export { extractKeywords };
