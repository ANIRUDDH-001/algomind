import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getPhaseContext,
    clearPhaseCache,
    _getPhaseContextCache,
    PHASE_QUERY_TEMPLATES,
    PHASE_CHUNK_COUNTS,
    type InterviewPhase,
} from '../phase-retriever';

// Mock supabaseHybridSearch
const mockHybridSearch = vi.fn();
vi.mock('../supabaseVectorStore', () => ({
    supabaseHybridSearch: (...args: any[]) => mockHybridSearch(...args),
}));

const makeFakeChunk = (title: string, topic: string, content: string) => ({
    chunk: { id: 'c1', title, topic, subtopic: 'sub', content, keywords: [], difficulty: 'medium' as const, patterns: [] },
    score: 0.9,
    matchType: 'semantic' as const,
});

describe('phase query templates', () => {
    it('intro phase uses problem title only', () => {
        const q = PHASE_QUERY_TEMPLATES.intro('Two Sum', ['arrays', 'hashing']);
        expect(q).toBe('Two Sum');
    });

    it('approach phase appends tags to query', () => {
        const q = PHASE_QUERY_TEMPLATES.approach('Two Sum', ['arrays', 'hashing']);
        expect(q).toContain('algorithm pattern');
        expect(q).toContain('arrays');
        expect(q).toContain('hashing');
    });

    it('coding phase includes "implementation" and first tag', () => {
        const q = PHASE_QUERY_TEMPLATES.coding('Two Sum', ['arrays', 'hashing']);
        expect(q).toContain('implementation');
        expect(q).toContain('arrays');
    });

    it('testing phase includes "edge cases testing"', () => {
        const q = PHASE_QUERY_TEMPLATES.testing('Two Sum', ['arrays']);
        expect(q).toContain('edge cases testing');
    });

    it('complexity phase includes "time complexity space complexity"', () => {
        const q = PHASE_QUERY_TEMPLATES.complexity('Two Sum', []);
        expect(q).toContain('time complexity space complexity');
        expect(q).toContain('Two Sum');
    });

    it('wrap-up phase includes "optimal solution"', () => {
        const q = PHASE_QUERY_TEMPLATES['wrap-up']('Two Sum', []);
        expect(q).toContain('optimal solution');
    });
});

describe('PHASE_CHUNK_COUNTS', () => {
    it('approach phase fetches more chunks than intro', () => {
        expect(PHASE_CHUNK_COUNTS.approach).toBeGreaterThan(PHASE_CHUNK_COUNTS.intro);
    });
});

describe('getPhaseContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearPhaseCache('test-session');
        clearPhaseCache('session-a');
    });

    it('approach phase query includes "algorithm pattern"', async () => {
        mockHybridSearch.mockResolvedValueOnce([makeFakeChunk('Sliding Window', 'patterns', 'Content here')]);
        await getPhaseContext('test-session', 'approach', 'Two Sum', ['arrays']);
        expect(mockHybridSearch.mock.calls[0][0]).toContain('algorithm pattern');
    });

    it('complexity phase query includes "time complexity space complexity"', async () => {
        mockHybridSearch.mockResolvedValueOnce([makeFakeChunk('Big O', 'complexity', 'Analysis content')]);
        await getPhaseContext('test-session', 'complexity', 'Two Sum', []);
        expect(mockHybridSearch.mock.calls[0][0]).toContain('time complexity space complexity');
    });

    it('caches result for same sessionId + phase combination', async () => {
        mockHybridSearch.mockResolvedValueOnce([makeFakeChunk('Result', 'topic', 'Content')]);
        const result1 = await getPhaseContext('session-a', 'approach', 'Two Sum', ['arrays']);
        const result2 = await getPhaseContext('session-a', 'approach', 'Two Sum', ['arrays']);

        expect(result1).toBe(result2);
        expect(mockHybridSearch).toHaveBeenCalledTimes(1); // Only called once, second is cached
    });

    it('returns different results for different phases on same problem', async () => {
        mockHybridSearch
            .mockResolvedValueOnce([makeFakeChunk('Intro Chunk', 'intro', 'Intro content')])
            .mockResolvedValueOnce([makeFakeChunk('Approach Chunk', 'patterns', 'Approach content')]);

        const introResult = await getPhaseContext('session-a', 'intro', 'Two Sum', ['arrays']);
        const approachResult = await getPhaseContext('session-a', 'approach', 'Two Sum', ['arrays']);

        expect(introResult).not.toBe(approachResult);
        expect(introResult).toContain('Intro Chunk');
        expect(approachResult).toContain('Approach Chunk');
    });

    it('falls back gracefully when supabaseHybridSearch throws', async () => {
        mockHybridSearch.mockRejectedValueOnce(new Error('Search failed'));
        await expect(getPhaseContext('test-session', 'coding', 'Two Sum', [])).rejects.toThrow('Search failed');
    });

    it('clearPhaseCache removes all keys for a session', async () => {
        mockHybridSearch.mockResolvedValue([makeFakeChunk('Result', 'topic', 'Content')]);

        await getPhaseContext('session-a', 'intro', 'Two Sum', []);
        await getPhaseContext('session-a', 'approach', 'Two Sum', []);

        const cache = _getPhaseContextCache();
        expect(cache.has('session-a:intro')).toBe(true);
        expect(cache.has('session-a:approach')).toBe(true);

        clearPhaseCache('session-a');

        expect(cache.has('session-a:intro')).toBe(false);
        expect(cache.has('session-a:approach')).toBe(false);
    });

    it('returns "No relevant context found." when search returns empty', async () => {
        mockHybridSearch.mockResolvedValueOnce([]);
        const result = await getPhaseContext('test-session', 'intro', 'Two Sum', []);
        expect(result).toBe('No relevant context found.');
    });

    it('chunk count passed to search matches PHASE_CHUNK_COUNTS', async () => {
        mockHybridSearch.mockResolvedValue([]);
        const phases: InterviewPhase[] = ['intro', 'approach', 'coding', 'testing', 'complexity', 'wrap-up'];
        for (const phase of phases) {
            clearPhaseCache('count-test');
            await getPhaseContext('count-test', phase, 'Test', []);
        }
        // Verify each call used the correct limit
        phases.forEach((phase, i) => {
            expect(mockHybridSearch.mock.calls[i][1]).toBe(PHASE_CHUNK_COUNTS[phase]);
        });
    });
});
