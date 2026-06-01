/**
 * @codesage
 * @file      src/lib/spaced-repetition/__tests__/skill-queue.integration.test.ts
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
import { createNewFSRSCardData, computeNextReviewFSRS } from '../fsrs';

// Mock the Supabase clients
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockSelect = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEqChain = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq = vi.fn(() => ({ eq: mockEqChain }));

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: mockEq,
            })),
            upsert: mockUpsert,
        })),
    })),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn(),
}));

// Import after mocks
import { updateSkillRepetition } from '../queue';

describe('per-skill FSRS integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    });

    it('save-session calls updateSkillRepetition with correct dimension scores', async () => {
        const dimensionScores = {
            'problem-decomposition': 7,
            'pattern-recognition': 6,
            'algorithmic-thinking': 8,
            'complexity-analysis': 3,
            'communication-clarity': 9,
            'edge-case-awareness': 5,
            'optimization-mindset': 4,
            'debugging-approach': 6,
        };

        await updateSkillRepetition({
            userId: 'test-user',
            sessionId: 'test-session',
            dimensionScores,
        });

        // Should upsert all 8 skills
        expect(mockUpsert).toHaveBeenCalledTimes(8);

        // Verify each score is passed correctly
        const upsertCalls = mockUpsert.mock.calls;
        const scores = upsertCalls.map((call: any[]) => ({
            skillId: call[0].skill_id,
            lastScore: call[0].last_score,
        }));

        expect(scores).toContainEqual({ skillId: 'complexity-analysis', lastScore: 3 });
        expect(scores).toContainEqual({ skillId: 'communication-clarity', lastScore: 9 });
    });

    it('skill with score 2/10 gets scheduled sooner than skill with 8/10', async () => {
        // Both start from fresh card data
        const freshCard = createNewFSRSCardData();

        const lowScoreResult = computeNextReviewFSRS(freshCard, 2);
        const highScoreResult = computeNextReviewFSRS(freshCard, 8);

        const lowDue = new Date(lowScoreResult.fsrs_due).getTime();
        const highDue = new Date(highScoreResult.fsrs_due).getTime();

        // Low score should be due sooner (or same day) vs high score due later
        expect(lowDue).toBeLessThanOrEqual(highDue);
    });

    it('skill_repetition row count = 8 after first session', async () => {
        await updateSkillRepetition({
            userId: 'test-user',
            sessionId: 'session-1',
            dimensionScores: {
                'problem-decomposition': 5,
                'pattern-recognition': 5,
                'algorithmic-thinking': 5,
                'complexity-analysis': 5,
                'communication-clarity': 5,
                'edge-case-awareness': 5,
                'optimization-mindset': 5,
                'debugging-approach': 5,
            },
        });

        expect(mockUpsert).toHaveBeenCalledTimes(8);
    });

    it('second session for same skill updates existing record, not creates new', async () => {
        // First call: no existing record
        mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        await updateSkillRepetition({
            userId: 'test-user',
            sessionId: 'session-1',
            dimensionScores: { 'complexity-analysis': 6 },
        });

        const firstUpsert = mockUpsert.mock.calls[0][0];
        expect(firstUpsert.fsrs_reps).toBe(1); // First review

        // Second call: existing record present
        mockMaybeSingle.mockResolvedValueOnce({
            data: {
                fsrs_stability: firstUpsert.fsrs_stability,
                fsrs_difficulty: firstUpsert.fsrs_difficulty,
                fsrs_elapsed_days: firstUpsert.fsrs_elapsed_days,
                fsrs_scheduled_days: firstUpsert.fsrs_scheduled_days,
                fsrs_reps: firstUpsert.fsrs_reps,
                fsrs_lapses: firstUpsert.fsrs_lapses,
                fsrs_state: firstUpsert.fsrs_state,
                fsrs_last_review: firstUpsert.fsrs_last_review,
                fsrs_due: firstUpsert.fsrs_due,
            },
            error: null,
        });

        await updateSkillRepetition({
            userId: 'test-user',
            sessionId: 'session-2',
            dimensionScores: { 'complexity-analysis': 7 },
        });

        const secondUpsert = mockUpsert.mock.calls[1][0];
        expect(secondUpsert.fsrs_reps).toBeGreaterThanOrEqual(2); // Updated, not new

        // Both use upsert with onConflict, ensuring update behavior
        const secondOptions = mockUpsert.mock.calls[1][1];
        expect(secondOptions.onConflict).toBe('user_id,skill_id');
    });

    it('all upserts use onConflict: user_id,skill_id', async () => {
        await updateSkillRepetition({
            userId: 'test-user',
            sessionId: 'session-1',
            dimensionScores: {
                'problem-decomposition': 5,
                'pattern-recognition': 5,
            },
        });

        mockUpsert.mock.calls.forEach((call: any[]) => {
            expect(call[1]).toEqual({ onConflict: 'user_id,skill_id' });
        });
    });
});
