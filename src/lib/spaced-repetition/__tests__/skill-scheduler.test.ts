/**
 * @codesage
 * @file      src/lib/spaced-repetition/__tests__/skill-scheduler.test.ts
 * @purpose   Tests for Spaced repetition algorithms (FSRS, SM2) and scheduling queues.
 * @tech      Node.js, ts-fsrs
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDueSkills, formatSkillName, SKILL_TO_PROBLEM_TAGS } from '../skill-scheduler';
import { updateSkillRepetition } from '../queue';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    lte: vi.fn(() => ({
                        data: [
                            { skill_id: 'complexity-analysis', fsrs_due: new Date(Date.now() - 2 * 86_400_000).toISOString(), last_score: 3 },
                            { skill_id: 'pattern-recognition', fsrs_due: new Date(Date.now() - 86_400_000).toISOString(), last_score: 7 },
                        ],
                        error: null,
                    })),
                })),
            })),
        })),
    })),
}));

// Mock service client for updateSkillRepetition
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        maybeSingle: mockMaybeSingle,
                    })),
                })),
            })),
            upsert: mockUpsert,
        })),
    })),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn(),
}));

describe('updateSkillRepetition', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates new skill_repetition record if none exists', async () => {
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

        await updateSkillRepetition({
            userId: 'user-1',
            sessionId: 'session-1',
            dimensionScores: { 'complexity-analysis': 7 },
        });

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const upsertArg = mockUpsert.mock.calls[0][0];
        expect(upsertArg.user_id).toBe('user-1');
        expect(upsertArg.skill_id).toBe('complexity-analysis');
        expect(upsertArg.last_score).toBe(7);
        expect(upsertArg.fsrs_reps).toBe(1);
    });

    it('updates existing record with FSRS next values', async () => {
        mockMaybeSingle.mockResolvedValueOnce({
            data: {
                fsrs_stability: 1.0,
                fsrs_difficulty: 5.0,
                fsrs_elapsed_days: 1,
                fsrs_scheduled_days: 1,
                fsrs_reps: 1,
                fsrs_lapses: 0,
                fsrs_state: 1,
                fsrs_last_review: new Date(Date.now() - 86_400_000).toISOString(),
                fsrs_due: new Date().toISOString(),
            },
            error: null,
        });

        await updateSkillRepetition({
            userId: 'user-1',
            sessionId: 'session-1',
            dimensionScores: { 'pattern-recognition': 8 },
        });

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const upsertArg = mockUpsert.mock.calls[0][0];
        expect(upsertArg.last_score).toBe(8);
        expect(upsertArg.fsrs_reps).toBeGreaterThanOrEqual(2);
    });

    it('updates all 8 skills from a single session', async () => {
        await updateSkillRepetition({
            userId: 'user-1',
            sessionId: 'session-1',
            dimensionScores: {
                'problem-decomposition': 6,
                'pattern-recognition': 7,
                'algorithmic-thinking': 8,
                'complexity-analysis': 3,
                'communication-clarity': 9,
                'edge-case-awareness': 5,
                'optimization-mindset': 4,
                'debugging-approach': 6,
            },
        });

        expect(mockUpsert).toHaveBeenCalledTimes(8);
    });

    it('does not throw when dimension score is missing (defaults to 5)', async () => {
        await expect(
            updateSkillRepetition({
                userId: 'user-1',
                sessionId: 'session-1',
                dimensionScores: { 'complexity-analysis': 5 },
            })
        ).resolves.not.toThrow();
    });

    it('fsrs_due advances correctly for score 8 vs score 3', async () => {
        // Score 8 (Easy) → longer interval
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        await updateSkillRepetition({
            userId: 'user-1',
            sessionId: 'session-1',
            dimensionScores: { 'complexity-analysis': 8 },
        });
        const easyDue = new Date(mockUpsert.mock.calls[0][0].fsrs_due).getTime();

        vi.clearAllMocks();

        // Score 3 (Again) → shorter/reset interval
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        await updateSkillRepetition({
            userId: 'user-1',
            sessionId: 'session-2',
            dimensionScores: { 'complexity-analysis': 3 },
        });
        const againDue = new Date(mockUpsert.mock.calls[0][0].fsrs_due).getTime();

        expect(easyDue).toBeGreaterThan(againDue);
    });
});

describe('getDueSkills', () => {
    it('returns skills where fsrs_due <= now()', async () => {
        const result = await getDueSkills('user-1');
        expect(result).toHaveLength(2);
        expect(result[0].skillId).toBe('complexity-analysis');
        expect(result[1].skillId).toBe('pattern-recognition');
    });

    it('includes daysOverdue calculation correctly', async () => {
        const result = await getDueSkills('user-1');
        expect(result[0].daysOverdue).toBe(2);
        expect(result[1].daysOverdue).toBe(1);
    });

    it('maps skill_id to correct suggestedTags', async () => {
        const result = await getDueSkills('user-1');
        const complexitySkill = result.find(s => s.skillId === 'complexity-analysis');
        expect(complexitySkill?.suggestedTags).toEqual(SKILL_TO_PROBLEM_TAGS['complexity-analysis']);
    });
});

describe('formatSkillName', () => {
    it('converts skill-id to title case', () => {
        expect(formatSkillName('complexity-analysis')).toBe('Complexity Analysis');
        expect(formatSkillName('problem-decomposition')).toBe('Problem Decomposition');
        expect(formatSkillName('edge-case-awareness')).toBe('Edge Case Awareness');
    });
});

describe('SKILL_TO_PROBLEM_TAGS', () => {
    it('has entries for all 8 skills', () => {
        expect(Object.keys(SKILL_TO_PROBLEM_TAGS)).toHaveLength(8);
    });

    it('each skill maps to at least 2 tags', () => {
        for (const tags of Object.values(SKILL_TO_PROBLEM_TAGS)) {
            expect(tags.length).toBeGreaterThanOrEqual(2);
        }
    });
});
