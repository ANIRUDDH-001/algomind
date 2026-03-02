import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionData } from '../memory-generator';

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn(),
}));

const mockGenerateCompletion = vi.fn();

vi.mock('../client', () => ({
    UnifiedAIClient: vi.fn().mockImplementation(function () {
        return { generateCompletion: mockGenerateCompletion };
    }),
}));

const mockSupabase = {
    rpc: vi.fn(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
};

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(() => mockSupabase),
}));

// ── updateKaiMemory ───────────────────────────────────────────────────────────

describe('updateKaiMemory()', () => {
    let updateKaiMemory: typeof import('../memory-generator')['updateKaiMemory'];

    const structuredResponse = JSON.stringify({
        topStrength: { skill: 'pattern-recognition', evidence: 'good' },
        mainWeakness: { skill: 'complexity-analysis', evidence: 'bad' },
        communicationStyle: 'conversational',
        focusForNextSession: 'none'
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        const mod = await import('../memory-generator');
        updateKaiMemory = mod.updateKaiMemory;

        const rpcRow = {
            session_id: 'sess-001',
            problem_id: 'two-sum',
            completed_at: new Date().toISOString(),
            overall_score: 7.5,
            problem_decomposition: 8,
            pattern_recognition: 6,
            algorithmic_thinking: 7,
            complexity_analysis: 5,
            communication_clarity: 9,
            edge_case_awareness: 4,
            optimization_mindset: 6,
            debugging_approach: 7,
        };

        mockSupabase.rpc.mockResolvedValue({ data: [rpcRow], error: null });
        mockSupabase.maybeSingle.mockResolvedValue({ data: { kai_memory: null, kai_memory_structured: null }, error: null });
        mockSupabase.upsert = vi.fn().mockResolvedValue({ error: null });

        // AI returns structured JSON
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: structuredResponse,
        });
    });

    it('fetches sessions via RPC with correct user_id and limit', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'get_user_sessions_with_assessment',
            { p_user_id: 'user-abc', p_limit: 5 }
        );
    });

    it('reads existing kai_memory and structured from learner_profiles', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.from).toHaveBeenCalledWith('learner_profiles');
        expect(mockSupabase.select).toHaveBeenCalledWith('kai_memory, kai_memory_structured');
        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-abc');
    });

    it('upserts new memory and structured payload into learner_profiles on success', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-abc',
                kai_memory_structured: expect.objectContaining({ communicationStyle: 'conversational' }),
            }),
            { onConflict: 'user_id' }
        );
    });

    it('does not upsert when AI returns failure', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({ success: false, error: 'fail' });
        await updateKaiMemory('user-abc');
        expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('returns early when RPC returns an error', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await updateKaiMemory('user-abc');
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('RPC error'),
            expect.any(String)
        );
        errorSpy.mockRestore();
    });

    it('returns early when RPC returns 0 sessions', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
        await updateKaiMemory('user-abc');
        expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('logs upsert error but does not throw', async () => {
        mockSupabase.upsert = vi.fn().mockResolvedValue({ error: { message: 'Upsert failed' } });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await expect(updateKaiMemory('user-abc')).resolves.toBeUndefined();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('DB upsert error'),
            expect.any(String)
        );
        errorSpy.mockRestore();
    });

    it('never throws on unexpected errors', async () => {
        mockSupabase.rpc.mockRejectedValue(new Error('Catastrophic failure'));
        await expect(updateKaiMemory('user-abc')).resolves.toBeUndefined();
    });

    it('passes existing structured memory context to AI prompt', async () => {
        const fakeStructured = {
            topStrength: { skill: 'debugging-approach', evidence: 'good debugger' },
            mainWeakness: { skill: 'edge-case-awareness', evidence: 'misses edge cases' },
            communicationStyle: 'analytical' as const,
            focusForNextSession: 'test edge cases'
        };
        mockSupabase.maybeSingle.mockResolvedValue({
            data: { kai_memory: 'old', kai_memory_structured: fakeStructured },
            error: null,
        });

        await updateKaiMemory('user-abc');

        // The AI prompt should contain the serialized existing memory
        const prompt = mockGenerateCompletion.mock.calls[0][0][0].content as string;
        expect(prompt).toContain('good debugger');
    });
});
