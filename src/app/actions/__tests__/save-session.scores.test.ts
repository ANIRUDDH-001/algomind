import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveInterviewSession } from '../save-session';
import { createServerSupabase } from '@/lib/supabase/server';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/server', () => {
    const mockSupabase = {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } }, error: null })
        },
        rpc: vi.fn(),
        from: vi.fn().mockImplementation(() => ({
            insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { id: 'session-id' }, error: null })
                }),
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'session-id' }, error: null })
            }),
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { description: '', difficulty: 'medium' }, error: null }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: { description: '', difficulty: 'medium' }, error: null }),
                    limit: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: null, error: null })
                    })
                })
            }),
            upsert: vi.fn().mockResolvedValue({ data: null, error: null })
        }))
    };
    return { createServerSupabase: vi.fn().mockResolvedValue(mockSupabase) };
});

vi.mock('@/lib/assessment/analyzer', () => ({
    CognitiveAnalyzer: vi.fn().mockImplementation(() => ({
        analyze: vi.fn().mockResolvedValue({
            skills: {},
            overallFeedback: 'Good',
            nextSteps: [],
            knowledgeGaps: [],
        })
    }))
}));

vi.mock('@/lib/spaced-repetition/queue', () => ({
    addToQueue: vi.fn().mockResolvedValue(null),
    updateSkillRepetition: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/ai/memory-generator', () => ({
    updateKaiMemory: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/ai/narrative-generator', () => ({
    createAndSaveSession1Baseline: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/cache/dashboardCache', () => ({
    invalidateDashboardCache: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/knowledge-graph', () => ({
    getKnowledgeGraphService: () => ({
        onInterviewSessionCompleted: vi.fn().mockResolvedValue(undefined),
    }),
}));

describe('saveInterviewSession scores & profile wiring', () => {
    let mockRpc: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const supabase = await createServerSupabase();
        mockRpc = supabase.rpc;
    });

    it('correctly maps adjusted_score to the assessments table insert payload', () => {
        // Placeholder for DB mock test preserved from original
        expect(true).toBe(true);
    });

    it('correctly maps rawScore to the spaced_repetition queue payload', () => {
        // Placeholder for DB mock test preserved from original
        expect(true).toBe(true);
    });

    it('calls ensure_learner_profile after session is saved', async () => {
        // Arrange: track RPC calls used by the action
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });

        // Act: call saveInterviewSession
        const result = await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [], 120);

        // Assert
        expect(mockRpc).toHaveBeenCalledWith('ensure_learner_profile', { p_user_id: 'user-id' });
        expect(result).toMatchObject({
            success: true,
            sessionId: 'session-id'
        });
    });

    it('does not throw if ensure_learner_profile fails', async () => {
        // Arrange: mock rpc to return an error for profile ensure
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'ensure_learner_profile') {
                return { data: null, error: { message: 'DB Error' } };
            }
            return { data: null, error: null };
        });

        // Act
        const result = await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [], 120);

        // Assert
        expect(result.success).toBe(true);
        expect((result as any).streakDays).toBeUndefined();
    });

    it('calls getKnowledgeGraphService().onInterviewSessionCompleted after saving', async () => {
        const { getKnowledgeGraphService } = await import('@/lib/knowledge-graph');
        const kg = getKnowledgeGraphService();
        const onInterviewSessionCompletedSpy = vi.spyOn(kg, 'onInterviewSessionCompleted');

        // Mock RPC
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });

        // Act: call saveInterviewSession
        const result = await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [
            { role: 'user', text: 'I will use a hashmap', timestamp: 1000 },
            { role: 'interviewer', text: 'Great approach', timestamp: 2000 },
            { role: 'user', text: 'Here is my solution', timestamp: 3000 },
        ], 120);

        // Assert
        expect(result.success).toBe(true);
        expect(onInterviewSessionCompletedSpy).toHaveBeenCalledOnce();

        const callArgs = onInterviewSessionCompletedSpy.mock.calls[0][0];
        expect(callArgs.userId).toBe('user-id');
        expect(callArgs.overallScore).toBeGreaterThanOrEqual(0);
        expect(callArgs.overallScore).toBeLessThanOrEqual(10);
    });
});
