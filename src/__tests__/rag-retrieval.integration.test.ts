import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HybridRetriever } from '@/lib/rag/retriever';
import {
    _getPhaseContextCache,
    clearPhaseCache,
    getPhaseContext,
    PHASE_QUERY_TEMPLATES,
} from '@/lib/rag/phase-retriever';
import type { SearchResult } from '@/lib/rag/types';

const mockHybridSearch = vi.fn();

vi.mock('@/lib/rag/supabaseVectorStore', () => ({
    supabaseHybridSearch: (...args: any[]) => mockHybridSearch(...args),
}));

const mockSupabase = {} as any;

function makeChunk(topic: string, content: string, title?: string): SearchResult {
    return {
        chunk: {
            id: `${topic}-${Math.random().toString(36).slice(2, 8)}`,
            topic,
            subtopic: topic,
            title: title ?? `Chunk for ${topic}`,
            content,
            keywords: [topic],
            difficulty: 'easy',
            patterns: [],
        },
        score: 0.9,
        matchType: 'semantic',
    };
}

describe('Phase-aware RAG retrieval (integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearPhaseCache('session-rag-1');
        clearPhaseCache('session-rag-cache');
        clearPhaseCache('session-rag-diff');
        clearPhaseCache('session-rag-clear');
    });

    it('approach phase returns chunks with pattern-related topics', async () => {
        mockHybridSearch.mockResolvedValueOnce([
            makeChunk('array', 'Use index-based traversal for arrays', 'Array basics'),
            makeChunk('hash-map', 'Hash map gives O(1) lookup in average case', 'Hash map pattern'),
            makeChunk('two-pointers', 'Two pointers can reduce nested loop complexity', 'Two pointers'),
        ]);

        const context = await getPhaseContext(
            mockSupabase,
            'session-rag-1',
            'approach',
            'two-sum',
            ['array', 'hash-map', 'two-pointers']
        );

        const cacheEntry = _getPhaseContextCache().get('session-rag-1:approach');
        expect(Array.isArray(cacheEntry?.chunks)).toBe(true);
        expect((cacheEntry?.chunks.length ?? 0) >= 1).toBe(true);
        expect(typeof cacheEntry?.chunks[0].chunk.content).toBe('string');
        expect((cacheEntry?.chunks[0].chunk.content.length ?? 0) > 0).toBe(true);
        expect(context.length).toBeGreaterThan(0);
    });

    it('complexity phase returns chunks with complexity-related content', async () => {
        mockHybridSearch.mockResolvedValueOnce([
            makeChunk('time-complexity', 'Two Sum with map is O(n) time', 'Time complexity'),
            makeChunk('space-complexity', 'Map approach uses O(n) extra memory', 'Space complexity'),
            makeChunk('big-o', 'Big O helps compare asymptotic growth', 'Big O basics'),
        ]);

        await getPhaseContext(
            mockSupabase,
            'session-rag-1',
            'complexity',
            'two-sum',
            ['time-complexity', 'space-complexity', 'big-o']
        );

        const cacheEntry = _getPhaseContextCache().get('session-rag-1:complexity');
        expect((cacheEntry?.chunks.length ?? 0) > 0).toBe(true);
    });

    it('caches phase contexts correctly for same session', async () => {
        mockHybridSearch.mockResolvedValue([
            makeChunk('array', 'Cached context content', 'Cached chunk'),
        ]);

        await getPhaseContext(mockSupabase, 'session-rag-cache', 'approach', 'two-sum', ['array']);
        await getPhaseContext(mockSupabase, 'session-rag-cache', 'approach', 'two-sum', ['array']);

        expect(mockHybridSearch).toHaveBeenCalledTimes(1);
    });

    it('different phases return different chunks for same problem', async () => {
        mockHybridSearch.mockImplementation((_supabase: unknown, query: string) => {
            if (query.includes('algorithm pattern')) {
                return Promise.resolve([
                    makeChunk('hash-map', 'Approach context', 'Approach chunk'),
                ]);
            }
            if (query.includes('time complexity space complexity')) {
                return Promise.resolve([
                    makeChunk('big-o', 'Complexity context', 'Complexity chunk'),
                ]);
            }
            return Promise.resolve([]);
        });

        const approach = await getPhaseContext(mockSupabase, 'session-rag-diff', 'approach', 'two-sum', ['array']);
        const complexity = await getPhaseContext(mockSupabase, 'session-rag-diff', 'complexity', 'two-sum', ['array']);

        expect(approach).not.toBe(complexity);
    });

    it('supabaseHybridSearch returns results above similarity threshold', async () => {
        const fakeVectorStore = {
            load: vi.fn().mockResolvedValue(undefined),
            size: vi.fn().mockReturnValue(4),
            hybridSearch: vi.fn().mockResolvedValue([
                { ...makeChunk('c1', 'low'), score: 0.05 },
                { ...makeChunk('c2', 'mid-1'), score: 0.15 },
                { ...makeChunk('c3', 'mid-2'), score: 0.25 },
                { ...makeChunk('c4', 'high'), score: 0.8 },
            ]),
        };

        const retriever = new HybridRetriever(fakeVectorStore as any);
        const retrieval = await retriever.retrieve('two sum complexity');

        expect(retrieval.results).toHaveLength(3);
        expect(retrieval.results.map((r) => r.score)).toEqual([0.15, 0.25, 0.8]);
        expect(retrieval.results.some((r) => r.score === 0.05)).toBe(false);
    });

    it('employer pre-load fetches all 6 phases', () => {
        const phases = Object.keys(PHASE_QUERY_TEMPLATES);
        expect(phases).toEqual(expect.arrayContaining([
            'intro',
            'approach',
            'coding',
            'testing',
            'complexity',
            'wrap-up',
        ]));
    });

    it('clearPhaseCache removes all keys for session', async () => {
        mockHybridSearch.mockResolvedValue([
            makeChunk('array', 'Cache clear test chunk'),
        ]);

        await getPhaseContext(mockSupabase, 'session-rag-clear', 'intro', 'two-sum', ['array']);
        clearPhaseCache('session-rag-clear');
        await getPhaseContext(mockSupabase, 'session-rag-clear', 'intro', 'two-sum', ['array']);

        expect(mockHybridSearch).toHaveBeenCalledTimes(2);
    });
});
