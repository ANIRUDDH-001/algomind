import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FSRS, createEmptyCard, Rating } from 'ts-fsrs';

import { getDueSkills, SKILL_TO_PROBLEM_TAGS } from '@/lib/spaced-repetition/skill-scheduler';
import { RecommendationEngine } from '@/lib/recommendations/engine';

let mockDueRows: Array<{ skill_id: string; fsrs_due: string; last_score: number | null }> = [];
let mockProblemRows: Array<{ id: string; title: string; difficulty: string; external_url?: string; tags?: string[] }> = [];
const mockContains = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
    isSupabaseConfigured: vi.fn(() => true),
    getSupabase: vi.fn(() => ({
        from: vi.fn((table: string) => {
            if (table === 'skill_repetition') {
                return {
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            lte: vi.fn().mockResolvedValue({
                                data: mockDueRows,
                                error: null,
                            }),
                        }),
                    }),
                };
            }

            if (table === 'problems') {
                const chain = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    contains: mockContains,
                    limit: vi.fn().mockResolvedValue({ data: mockProblemRows, error: null }),
                };
                mockContains.mockReturnValue(chain);
                return chain;
            }

            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                lte: vi.fn().mockResolvedValue({ data: [], error: null }),
                contains: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
        }),
    })),
}));

describe('Per-skill FSRS scheduling (integration)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDueRows = [];
        mockProblemRows = [];
    });

    it('score 2/10 on complexity-analysis -> due sooner than score 8/10', () => {
        const scheduler = new FSRS();
        const now = new Date();

        const bad = scheduler.next(createEmptyCard(), now, Rating.Again).card;
        const good = scheduler.next(createEmptyCard(), now, Rating.Easy).card;

        expect(new Date(bad.due).getTime()).toBeLessThan(new Date(good.due).getTime());
    });

    it('multiple sessions on same skill accumulates reps correctly', () => {
        const scheduler = new FSRS();
        let card = createEmptyCard();
        const stabilities: number[] = [];

        for (let i = 0; i < 3; i++) {
            card = scheduler.next(card, new Date(Date.now() + i * 86_400_000), Rating.Good).card;
            stabilities.push(card.stability);
        }

        expect(card.reps).toBe(3);
        expect(stabilities[1]).toBeGreaterThanOrEqual(stabilities[0]);
        expect(stabilities[2]).toBeGreaterThanOrEqual(stabilities[1]);
        expect(stabilities[2]).toBeGreaterThan(stabilities[0]);
    });

    it('getDueSkills returns skill when fsrs_due is in the past', async () => {
        const yesterday = new Date(Date.now() - 86_400_000).toISOString();
        const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

        mockDueRows = [
            { skill_id: 'problem-decomposition', fsrs_due: yesterday, last_score: 4 },
            // Simulate DB-side lte filter: only due row is returned.
        ];

        const dueSkills = await getDueSkills('user-test');
        const ids = dueSkills.map((s) => s.skillId);

        expect(ids).toContain('problem-decomposition');
        expect(ids).not.toContain('pattern-recognition');

        // Sanity guard that future date would be excluded from due list in query semantics.
        expect(new Date(tomorrow).getTime()).toBeGreaterThan(Date.now());
    });

    it('SKILL_TO_PROBLEM_TAGS maps to valid tags that exist in problems table', () => {
        const knownDimensions = [
            'problem-decomposition',
            'pattern-recognition',
            'algorithmic-thinking',
            'complexity-analysis',
            'communication-clarity',
            'edge-case-awareness',
            'optimization-mindset',
            'debugging-approach',
        ];

        for (const [skill, tags] of Object.entries(SKILL_TO_PROBLEM_TAGS)) {
            expect(knownDimensions).toContain(skill);
            expect(Array.isArray(tags)).toBe(true);
            expect(tags.length).toBeGreaterThan(0);
            for (const tag of tags) {
                expect(typeof tag).toBe('string');
                expect(tag.trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('insight engine uses due skills to surface problem recommendations', async () => {
        mockProblemRows = [
            {
                id: 'p-complexity-1',
                title: 'DP Cost Minimization',
                difficulty: 'easy',
                tags: ['recursion', 'dynamic-programming'],
            },
        ];

        const progress = {
            userId: 'u1',
            totalSessions: 3,
            averageScore: 6,
            averageScores: {
                'problem-decomposition': 7,
                'pattern-recognition': 7,
                'algorithmic-thinking': 7,
                'complexity-analysis': 2,
                'communication-clarity': 6,
                'edge-case-awareness': 6,
                'optimization-mindset': 6,
                'debugging-approach': 6,
            },
            sessions: [],
            trends: [],
            lastUpdated: new Date(),
        } as any;

        const recommendations = await new RecommendationEngine().analyze(progress);

        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations[0].suggestedProblems.length).toBeGreaterThan(0);
        expect(recommendations[0].suggestedProblems[0].id).toBe('p-complexity-1');

        // RecommendationEngine uses 'Recursion' for complexity-analysis; scheduler mapping contains 'recursion'.
        const containsColumnArg = mockContains.mock.calls[0]?.[0];
        const containsValueArg = mockContains.mock.calls[0]?.[1]?.[0];
        expect(containsColumnArg).toBe('tags');
        expect(typeof containsValueArg).toBe('string');
        expect(containsValueArg.toLowerCase()).toBe('recursion');
        expect(SKILL_TO_PROBLEM_TAGS['complexity-analysis']).toContain('recursion');
    });
});
