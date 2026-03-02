import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    buildConsistencyGapCards,
    buildDifficultyPlateauCard,
    buildSkillImbalanceCard,
    buildProblemTypeGapCard,
    buildDecliningTrendCards,
    computeInsightsForUser
} from '../insight-engine';
import { SupabaseClient } from '@supabase/supabase-js';

const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn(),
    upsert: vi.fn()
} as any;

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: () => mockSupabase,
}));
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: () => mockSupabase,
}));

// Helper to create basic mocked sessions
function createSessions(count: number, overrides: Partial<any> = {}) {
    return Array.from({ length: count }).map((_, i) => ({
        session_id: `session-${i}`,
        problem_id: `prob-${i}`,
        problem_title: `Problem ${i}`,
        problem_difficulty: 'medium',
        completed_at: new Date().toISOString(),
        overall_score: 5,
        problem_decomposition: 5,
        pattern_recognition: 5,
        algorithmic_thinking: 5,
        complexity_analysis: 5,
        communication_clarity: 5,
        edge_case_awareness: 5,
        optimization_mindset: 5,
        debugging_approach: 5,
        pattern_tags: ['bfs'],
        ...overrides
    })) as any[];
}

describe('new insight card builders', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('buildConsistencyGapCards', () => {
        it('returns empty array for < 5 sessions', async () => {
            const cards = await buildConsistencyGapCards(createSessions(4));
            expect(cards).toHaveLength(0);
        });

        it('returns card when skill variance > 2.5 AND range >= 4', async () => {
            // 10, 10, 1, 1, 1 for problem_decomposition
            // mean = 4.6, squared diffs = 29.16, 29.16, 12.96, 12.96, 12.96 -> 97.2 / 5 = 19.44 -> sqrt = 4.4
            const sessions = createSessions(5).map((s, i) => ({
                ...s,
                problem_decomposition: i < 2 ? 10 : 1
            }));
            const cards = await buildConsistencyGapCards(sessions);
            expect(cards.find(c => c.type === 'consistency_gap')).toBeDefined();
        });

        it('does not return card when variance is low', async () => {
            const sessions = createSessions(5, { problem_decomposition: 6 });
            const cards = await buildConsistencyGapCards(sessions);
            expect(cards).toHaveLength(0);
        });

        it('returns max 2 consistency gap cards', async () => {
            const sessions = createSessions(5).map((s, i) => ({
                ...s,
                problem_decomposition: i < 2 ? 10 : 1,
                pattern_recognition: i < 2 ? 10 : 1,
                algorithmic_thinking: i < 2 ? 10 : 1
            }));
            const cards = await buildConsistencyGapCards(sessions);
            expect(cards.length).toBeLessThanOrEqual(2);
        });
    });

    describe('buildDifficultyPlateauCard', () => {
        it('returns null for < 8 sessions', async () => {
            const card = await buildDifficultyPlateauCard(createSessions(7));
            expect(card).toBeNull();
        });

        it('returns plateau card when 6+ medium sessions, 0 hard, avg >= 6.5', async () => {
            const sessions = createSessions(8, { problem_difficulty: 'medium', overall_score: 7 });
            const card = await buildDifficultyPlateauCard(sessions);
            expect(card?.title).toBe('Ready for Hard Problems');
        });

        it('returns easy-to-medium card when 5+ easy, 0 medium', async () => {
            const sessions = createSessions(8, { problem_difficulty: 'easy' });
            const card = await buildDifficultyPlateauCard(sessions);
            expect(card?.title).toBe('Time to Move Beyond Easy');
        });

        it('returns null when hard sessions already exist', async () => {
            const sessions = createSessions(8).map((s, i) => ({
                ...s,
                problem_difficulty: i === 0 ? 'hard' : 'medium'
            }));
            const card = await buildDifficultyPlateauCard(sessions);
            expect(card).toBeNull();
        });
    });

    describe('buildSkillImbalanceCard', () => {
        it('returns null for < 4 sessions', async () => {
            expect(await buildSkillImbalanceCard(createSessions(3))).toBeNull();
        });

        it('returns card when worst skill is 2.5+ below overall average', async () => {
            // make problem_decomposition = 2, everything else = 8 -> avg ~7.25, worst = 2.
            const sessions = createSessions(4).map(s => ({
                ...s,
                problem_decomposition: 2,
                pattern_recognition: 8,
                algorithmic_thinking: 8,
                complexity_analysis: 8,
                communication_clarity: 8,
                edge_case_awareness: 8,
                optimization_mindset: 8,
                debugging_approach: 8,
            }));
            const card = await buildSkillImbalanceCard(sessions);
            expect(card?.title).toContain('Problem Decomposition is Your Bottleneck');
            expect(card?.priority).toBe('high');
        });

        it('correctly identifies the worst skill by name', async () => {
            const sessions = createSessions(4, { communication_clarity: 1, overall_score: 8 });
            const card = await buildSkillImbalanceCard(sessions);
            expect(card?.title).toContain('Communication Clarity is Your Bottleneck');
        });

        it('priority is high when gap >= 2.5', async () => {
            const sessions = createSessions(4, { communication_clarity: 1, overall_score: 8 });
            const card = await buildSkillImbalanceCard(sessions);
            expect(card?.priority).toBe('high');
        });
    });

    describe('buildProblemTypeGapCard', () => {
        it('returns null when all critical patterns are covered', async () => {
            const sessions = createSessions(8, { pattern_tags: ['dynamic-programming', 'binary-search', 'graphs', 'bfs', 'dfs', 'sliding-window', 'two-pointer', 'heap'] });
            expect(await buildProblemTypeGapCard(mockSupabase, sessions)).toBeNull();
        });

        it('returns card when DP pattern is missing', async () => {
            const sessions = createSessions(5, { pattern_tags: ['bfs', 'dfs'] });
            const card = await buildProblemTypeGapCard(mockSupabase, sessions);
            expect(card?.title).toContain('Dynamic Programming');
        });

        it('includes a problem suggestion for the missing pattern', async () => {
            mockSupabase.maybeSingle.mockResolvedValueOnce({
                data: { id: 'test-prob', title: 'Test', difficulty: 'medium' }
            });
            const sessions = createSessions(5, { pattern_tags: ['bfs'] });
            const card = await buildProblemTypeGapCard(mockSupabase, sessions);
            expect(card?.problemSuggestions).toBeDefined();
        });

        it('priority is high when 3+ critical patterns missing', async () => {
            const sessions = createSessions(5, { pattern_tags: [] }); // 8 missing
            const card = await buildProblemTypeGapCard(mockSupabase, sessions);
            expect(card?.priority).toBe('high');
        });
    });
});

describe('computeInsightsForUser card limit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('never returns more than 6 cards', async () => {
        // We mock get_user_sessions_with_assessment to return data causing all cards to trigger
        mockSupabase.rpc.mockResolvedValue({
            data: createSessions(10, { problem_difficulty: 'medium', overall_score: 7 })
        });

        // We should get at least momentum, streak, plateau cards, etc.
        // If not we just verify limit <= 6
        const snapshot = await computeInsightsForUser('u1');
        expect(snapshot.insights.length).toBeLessThanOrEqual(6);
    });

    it('high priority cards appear before medium priority', async () => {
        mockSupabase.rpc.mockResolvedValue({
            data: createSessions(10, { problem_difficulty: 'medium', overall_score: 7 })
        });
        const snapshot = await computeInsightsForUser('u1');
        let foundMedium = false;
        for (const card of snapshot.insights) {
            if (card.priority === 'medium') foundMedium = true;
            if (card.priority === 'high') {
                expect(foundMedium).toBeFalsy();
            }
        }
    });

    it('declining trend card uses same-difficulty comparison', async () => {
        // Construct sessions where medium went down but easy went up
        const sessions = [
            ...createSessions(3, { problem_difficulty: 'medium', problem_decomposition: 2 }), // recent medium
            ...createSessions(3, { problem_difficulty: 'easy', problem_decomposition: 8 }),   // recent easy
            ...createSessions(3, { problem_difficulty: 'medium', problem_decomposition: 8 }), // older medium
            ...createSessions(3, { problem_difficulty: 'easy', problem_decomposition: 2 }),   // older easy
        ];
        const cards = await buildDecliningTrendCards(mockSupabase, sessions, { tier: 3, label: 'mock' } as any);
        expect(cards.length).toBeGreaterThan(0);
        expect(cards[0].type).toBe('declining_trend');
    });
});
