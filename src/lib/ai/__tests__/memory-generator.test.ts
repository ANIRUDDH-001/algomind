// @vitest-environment node
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { generateKaiMemory, updateKaiMemory, type SessionData } from '../memory-generator';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../client', () => ({
    UnifiedAIClient: vi.fn().mockImplementation(function () { return mockAIClient; }),
}));

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(() => mockSupabase),
}));

// ── Shared mock objects ───────────────────────────────────────────────────────

const mockAIClient = {
    generateCompletion: vi.fn(),
};

const mockSupabase = {
    rpc: vi.fn(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const session1: SessionData = {
    sessionId: 'sess-001',
    problemTitle: 'Two Sum',
    problemDifficulty: 'easy',
    overallScore: 7.5,
    skills: {
        'problem-decomposition': 8,
        'pattern-recognition': 6,
        'algorithmic-thinking': 7,
        'complexity-analysis': 5,
        'communication-clarity': 9,
        'edge-case-awareness': 4,
        'optimization-mindset': 6,
        'debugging-approach': 7,
    },
    completedAt: new Date().toISOString(),
};

const session2: SessionData = {
    sessionId: 'sess-002',
    problemTitle: 'Binary Search',
    problemDifficulty: 'medium',
    overallScore: 6.0,
    skills: {
        'problem-decomposition': 5,
        'pattern-recognition': 7,
        'algorithmic-thinking': 6,
        'complexity-analysis': 8,
        'communication-clarity': 5,
        'edge-case-awareness': 7,
        'optimization-mindset': 4,
        'debugging-approach': 6,
    },
    completedAt: new Date().toISOString(),
};

// ── generateKaiMemory ─────────────────────────────────────────────────────────

describe('generateKaiMemory()', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty string (fallback) when recentSessions is empty and no existing memory', async () => {
        const result = await generateKaiMemory({
            userId: 'user-1',
            recentSessions: [],
            existingMemory: null,
        });
        expect(result).toBe('');
        expect(mockAIClient.generateCompletion).not.toHaveBeenCalled();
    });

    it('returns existingMemory when recentSessions is empty', async () => {
        const result = await generateKaiMemory({
            userId: 'user-1',
            recentSessions: [],
            existingMemory: 'Previous coaching note.',
        });
        expect(result).toBe('Previous coaching note.');
        expect(mockAIClient.generateCompletion).not.toHaveBeenCalled();
    });

    it('calls AI with correct parameters when sessions exist', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({
            success: true,
            response: '  Generated memory note.  ',
        });

        const result = await generateKaiMemory({
            userId: 'user-1',
            recentSessions: [session1],
            existingMemory: null,
        });

        expect(mockAIClient.generateCompletion).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ role: 'user', content: expect.stringContaining('Two Sum') }),
            ]),
            expect.objectContaining({
                preferredProvider: 'groq',
                maxTokens: 250,
                temperature: 0.5,
            })
        );
        expect(result).toBe('Generated memory note.'); // trimmed
    });

    it('trims whitespace from the AI response', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({
            success: true,
            response: '   \n  This student excels at communication.  \n   ',
        });
        const result = await generateKaiMemory({
            userId: 'user-1',
            recentSessions: [session1],
            existingMemory: null,
        });
        expect(result).toBe('This student excels at communication.');
    });

    it('includes previous memory in the prompt when provided', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: true, response: 'New memory' });

        await generateKaiMemory({
            userId: 'user-1',
            recentSessions: [session1],
            existingMemory: 'This student struggled with edge cases.',
        });

        const prompt = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        expect(prompt).toContain('This student struggled with edge cases.');
    });

    it('includes problem title and score in the prompt', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: true, response: 'Memory' });

        await generateKaiMemory({
            userId: 'u1',
            recentSessions: [session1],
            existingMemory: null,
        });

        const prompt = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        expect(prompt).toContain('Two Sum');
        expect(prompt).toContain('7.5');
    });

    it('uses only the 5 most recent sessions in the prompt', async () => {
        const manySessions = Array.from({ length: 8 }, (_, i) => ({
            ...session1,
            sessionId: `sess-${i}`,
            problemTitle: `Problem ${i}`,
        }));
        mockAIClient.generateCompletion.mockResolvedValue({ success: true, response: 'Memory' });

        await generateKaiMemory({ userId: 'u1', recentSessions: manySessions, existingMemory: null });

        const prompt = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        // Only first 5 should appear
        expect(prompt).toContain('Problem 0');
        expect(prompt).toContain('Problem 4');
        expect(prompt).not.toContain('Problem 5');
        expect(prompt).not.toContain('Problem 6');
        expect(prompt).not.toContain('Problem 7');
    });

    it('returns existingMemory as fallback when AI call fails (success=false)', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({
            success: false,
            error: 'Rate limited',
        });
        const result = await generateKaiMemory({
            userId: 'u1',
            recentSessions: [session1],
            existingMemory: 'Old memory.',
        });
        expect(result).toBe('Old memory.');
    });

    it('returns empty string as fallback when AI fails and no existing memory', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: false });
        const result = await generateKaiMemory({
            userId: 'u1',
            recentSessions: [session1],
            existingMemory: null,
        });
        expect(result).toBe('');
    });

    it('returns fallback and does not throw when AI throws an unexpected error', async () => {
        mockAIClient.generateCompletion.mockRejectedValue(new Error('Network failure'));
        const result = await generateKaiMemory({
            userId: 'u1',
            recentSessions: [session1],
            existingMemory: 'Safe fallback',
        });
        expect(result).toBe('Safe fallback');
    });

    it('correctly identifies the 2 weakest skills from session data', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: true, response: 'Done' });

        // session1 has edge-case-awareness=4 and complexity-analysis=5 as bottom 2
        await generateKaiMemory({ userId: 'u1', recentSessions: [session1], existingMemory: null });

        const prompt = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        // These skill display names should appear as weak skills
        expect(prompt).toMatch(/Edge Case Awareness|edge.case/i);
        expect(prompt).toMatch(/Complexity Analysis|complexity/i);
    });

    it('correctly identifies the 2 strongest skills from session data', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: true, response: 'Done' });

        // session1 has communication-clarity=9 and problem-decomposition=8 as top 2
        await generateKaiMemory({ userId: 'u1', recentSessions: [session1], existingMemory: null });

        const prompt = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        expect(prompt).toMatch(/Communication Clarity|communication/i);
        expect(prompt).toMatch(/Problem Decomposition|problem.decomp/i);
    });
});

// ── updateKaiMemory ───────────────────────────────────────────────────────────

describe('updateKaiMemory()', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: RPC returns 2 sessions
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
        mockSupabase.maybeSingle.mockResolvedValue({ data: { kai_memory: null }, error: null });
        mockSupabase.upsert = vi.fn().mockResolvedValue({ error: null });

        // AI generates a memory
        mockAIClient.generateCompletion.mockResolvedValue({
            success: true,
            response: 'This student shows strong communication skills.',
        });
    });

    it('fetches sessions via RPC with correct user_id and limit', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'get_user_sessions_with_assessment',
            { p_user_id: 'user-abc', p_limit: 5 }
        );
    });

    it('reads existing kai_memory from learner_profiles', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.from).toHaveBeenCalledWith('learner_profiles');
        expect(mockSupabase.select).toHaveBeenCalledWith('kai_memory');
        expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-abc');
    });

    it('upserts new memory into learner_profiles on success', async () => {
        await updateKaiMemory('user-abc');
        expect(mockSupabase.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'user-abc',
                kai_memory: 'This student shows strong communication skills.',
            }),
            { onConflict: 'user_id' }
        );
    });

    it('does not upsert when AI returns empty memory', async () => {
        mockAIClient.generateCompletion.mockResolvedValue({ success: false });
        await updateKaiMemory('user-abc');
        expect(mockSupabase.upsert).not.toHaveBeenCalled();
    });

    it('returns early (does not call AI) when RPC returns an error', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } });
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        await updateKaiMemory('user-abc');

        expect(mockAIClient.generateCompletion).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('RPC error'),
            expect.any(String)
        );
        errorSpy.mockRestore();
    });

    it('returns early (does not upsert) when RPC returns 0 sessions', async () => {
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

    it('passes existing memory to AI generation', async () => {
        mockSupabase.maybeSingle.mockResolvedValue({
            data: { kai_memory: 'Previous note about this student.' },
            error: null,
        });

        await updateKaiMemory('user-abc');

        const callArgs = mockAIClient.generateCompletion.mock.calls[0][0][0].content as string;
        expect(callArgs).toContain('Previous note about this student.');
    });
});
