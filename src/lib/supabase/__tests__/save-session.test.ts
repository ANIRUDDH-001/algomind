import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveInterviewSession } from '@/app/actions/save-session';
import { checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';
import { createServerSupabase } from '@/lib/supabase/server';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AssessmentResult } from '@/lib/assessment/analyzer';
import { ConversationTurn } from '@/lib/assessment/prompts';

// Mock Supabase Server
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

// Mock Supabase Client
vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(),
    isSupabaseConfigured: vi.fn()
}));

describe('Supabase Data Layer', () => {
    // Shared mocks
    const mockFrom = vi.fn();
    const mockRpc = vi.fn();
    const mockSingle = vi.fn();
    const mockInsertGaps = vi.fn();

    const mockSupabaseClient = {
        from: mockFrom,
        rpc: mockRpc
    };

    beforeEach(() => {
        vi.clearAllMocks();

        // Default Client Mocks
        (createServerSupabase as any).mockResolvedValue(mockSupabaseClient);
        (getSupabase as any).mockReturnValue(mockSupabaseClient);
        (isSupabaseConfigured as any).mockReturnValue(true);

        // Default DB Operation Mocks
        // Note: We'll override these in specific tests as needed
    });

    describe('saveInterviewSession', () => {
        const mockUserId = 'user-123';
        const mockProblemId = 'problem-abc';
        const mockTranscript: ConversationTurn[] = [];
        const mockResult: AssessmentResult = {
            sessionId: 'session-1',
            timestamp: new Date(),
            problem: { title: 'Two Sum', description: 'Desc', difficulty: 'Easy' },
            skills: { 'algorithmic-thinking': { score: 10, evidence: [], strengths: [], improvements: [], confidence: 1 } } as any, // minimal skill obj cast as any for test simplicity
            overallFeedback: 'Good',
            nextSteps: [],
            knowledgeGaps: []
        };

        it('should save session successfully (happy path)', async () => {
            // Setup specific chain for this test
            const mockInsertSession = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: mockSingle
                })
            });

            mockFrom.mockImplementation((table) => {
                if (table === 'interview_sessions') return { insert: mockInsertSession };
                if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
                return { insert: vi.fn(), upsert: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: { id: 'session-123' }, error: null });

            const result = await saveInterviewSession(
                mockUserId,
                mockProblemId,
                'Two Sum',
                mockTranscript as any,
                120,
                mockResult as any
            );

            expect(result).toEqual({ success: true });
            expect(mockFrom).toHaveBeenCalledWith('interview_sessions');
            expect(mockInsertSession).toHaveBeenCalledWith(expect.objectContaining({
                user_id: mockUserId,
                problem_title: 'Two Sum',
                duration: 120
            }));
        });

        it('should handle database error', async () => {
            const mockInsertSession = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: mockSingle
                })
            });

            mockFrom.mockImplementation((table) => {
                if (table === 'interview_sessions') return { insert: mockInsertSession };
                if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
                return { insert: mockInsertSession, upsert: vi.fn() };
            });
            mockSingle.mockResolvedValue({ data: null, error: { message: 'duplicate key' } });

            const result = await saveInterviewSession(
                mockUserId,
                mockProblemId,
                'Two Sum',
                mockTranscript as any,
                120,
                mockResult as any
            );

            expect(result).toEqual({ success: false, error: 'duplicate key' });
        });

        it('should save knowledge gaps if present', async () => {
            const mockInsertSession = vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    single: mockSingle
                })
            });
            const mockInsertGaps = vi.fn().mockResolvedValue({ error: null });

            mockFrom.mockImplementation((table) => {
                if (table === 'interview_sessions') return { insert: mockInsertSession };
                if (table === 'knowledge_gaps') return { insert: mockInsertGaps };
                if (table === 'profiles') return { upsert: vi.fn().mockResolvedValue({ error: null }) };
                return { insert: vi.fn(), upsert: vi.fn() };
            });

            mockSingle.mockResolvedValue({ data: { id: 'session-123' }, error: null });

            const resultWithGaps = {
                ...mockResult,
                knowledgeGaps: ['recursion', 'dynamic programming']
            };

            await saveInterviewSession(
                mockUserId,
                mockProblemId,
                'Two Sum',
                mockTranscript as any,
                120,
                resultWithGaps as any
            );

            expect(mockFrom).toHaveBeenCalledWith('knowledge_gaps');
            expect(mockInsertGaps).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ user_query: 'recursion', session_id: 'session-123' }),
                expect.objectContaining({ user_query: 'dynamic programming', session_id: 'session-123' })
            ]));
        });
    });

    describe('checkUserRateLimit', () => {
        it('should return allowed when below limit', async () => {
            mockRpc.mockResolvedValue({
                data: [{ allowed: true, remaining: 3, is_admin_user: false }],
                error: null
            });

            const result = await checkUserRateLimit('user-id');
            expect(result).toEqual({ allowed: true, remaining: 3, isAdmin: false });
        });

        it('should fail closed on RPC error', async () => {
            mockRpc.mockResolvedValue({
                data: null,
                error: { message: 'timeout' }
            });

            const result = await checkUserRateLimit('user-id');
            expect(result).toEqual({ allowed: false, remaining: 0, isAdmin: false });
        });
    });
});
