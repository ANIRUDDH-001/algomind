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

vi.mock('@/lib/knowledge-graph');

let mockOnInterviewSessionCompleted: any;

describe('saveInterviewSession scores & profile wiring', () => {
    let mockRpc: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Setup KG mock
        mockOnInterviewSessionCompleted = vi.fn().mockResolvedValue(undefined);
        const { getKnowledgeGraphService } = await import('@/lib/knowledge-graph');
        vi.mocked(getKnowledgeGraphService).mockReturnValue({
            onInterviewSessionCompleted: mockOnInterviewSessionCompleted,
        } as ReturnType<typeof getKnowledgeGraphService>);
        
        const supabase = await createServerSupabase();
        mockRpc = supabase.rpc;
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });
    });

    it('correctly maps adjusted_score to the assessments table insert payload', async () => {
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });

        await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [
            { role: 'user', content: 'I will use a hashmap approach for this problem' },
            { role: 'assistant', content: 'Good thinking, go ahead' },
        ], 120);

        // Verify the atomic save RPC was called with adjusted_score parameter
        const atomicCall = mockRpc.mock.calls.find((c: any[]) => c[0] === 'save_interview_session_atomic');
        expect(atomicCall).toBeDefined();
        expect(atomicCall![1]).toHaveProperty('p_assessment_adjusted_score');
    });

    it.skip('correctly maps rawScore to the spaced_repetition queue payload', async () => {
        const { addToQueue } = await import('@/lib/spaced-repetition/queue');

        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });

        await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [
            { role: 'user', content: 'I will use a hashmap approach for this problem' },
            { role: 'assistant', content: 'Good thinking, go ahead' },
        ], 120);

        // Verify addToQueue was called with the overallScore from the result
        expect(addToQueue).toHaveBeenCalled();
        const queueCall = (addToQueue as any).mock.calls[0][0];
        expect(queueCall).toHaveProperty('overallScore');
        expect(typeof queueCall.overallScore).toBe('number');
    });

    it('calls ensure_learner_profile after session is saved', async () => {
        // Arrange: track RPC calls used by the action
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
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
            data: {
                sessionId: 'session-id'
            }
        });
    });

    it('does not throw if ensure_learner_profile fails', async () => {
        // Arrange: mock rpc to return an error for profile ensure
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
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

    it.skip('calls getKnowledgeGraphService().onInterviewSessionCompleted after saving', async () => {
        // Mock RPC
        mockRpc.mockImplementation(async (name: string) => {
            if (name === 'save_interview_session_atomic') {
                return { data: { session_id: 'session-id', assessment_id: null }, error: null };
            }
            if (name === 'ensure_learner_profile') {
                return { data: null, error: null };
            }
            return { data: null, error: null };
        });

        // Act: call saveInterviewSession
        const result = await saveInterviewSession('user-id', 'problem-id', 'Two Sum', [
            { role: 'user', content: 'I will use a hashmap' },
            { role: 'assistant', content: 'Great approach' },
            { role: 'user', content: 'Here is my solution' },
        ], 120);

        // Assert
        expect(result.success).toBe(true);
        expect(mockOnInterviewSessionCompleted).toHaveBeenCalledOnce();

        const callArgs = mockOnInterviewSessionCompleted.mock.calls[0][0];
        expect(callArgs.userId).toBe('user-id');
        expect(callArgs.overallScore).toBeGreaterThanOrEqual(0);
        expect(callArgs.overallScore).toBeLessThanOrEqual(10);
    });
});
