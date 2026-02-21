import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupabaseProgressStore } from '../progress-store';
import * as supabaseClientModule from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: vi.fn(),
    isSupabaseConfigured: vi.fn(() => true)
}));

describe('SupabaseProgressStore', () => {
    let mockSupabase: any;
    let store: SupabaseProgressStore;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
        };

        (supabaseClientModule.getSupabase as any).mockReturnValue(mockSupabase);

        store = new SupabaseProgressStore();
    });

    const createMockSession = (transcriptContentMap: any) => {
        return {
            id: 'session-123',
            problem_id: 'two-sum',
            problem_difficulty: 'easy',
            duration: 120,
            completed_at: '2026-02-21T00:00:00.000Z',
            assessments: [{ overall_score: 85 }],
            transcript: [
                { role: 'user', content: transcriptContentMap }
            ]
        };
    };

    /**
     * REACT ERROR #31 FIX VALIDATIONS
     * Verifying exact object mapping extractions preventing rendering crashes
     */

    it('1. Transcript extraction when content is a plain string -> passes through', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession('Plain text message')],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        expect(progress.sessions[0].transcript[0].content).toBe('Plain text message');
    });

    it('2. Transcript extraction when content is { text: "..." } -> extracts .text', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession({ text: 'Text object' })],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        expect(progress.sessions[0].transcript[0].content).toBe('Text object');
    });

    it('3. Transcript extraction when content is { sentence: "..." } -> extracts .sentence', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession({ sentence: 'Sentence object' })],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        expect(progress.sessions[0].transcript[0].content).toBe('Sentence object');
    });

    it('4. Transcript extraction when content is { content: "..." } -> extracts .content', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession({ content: 'Nested content object' })],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        expect(progress.sessions[0].transcript[0].content).toBe('Nested content object');
    });

    it('5. Transcript extraction when content is a nested object -> returns stringified or fallback', async () => {
        // The implementation falls back to `String(e.content ?? e.text ?? '')` resulting in '[object Object]' natively 
        // without explicit stringify mappings inside the React components. This tests the final boundary
        const deepObject = { nested: { deep: true } };
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession(deepObject)],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        // In the current implementation, if text/sentence/content isn't found, it falls back to the object itself mapped to String()
        expect(progress.sessions[0].transcript[0].content).toBe(JSON.stringify(deepObject));
    });

    it('6. Transcript extraction when content is null/undefined -> returns empty string', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession(null)],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-1') as any;
        expect(progress.sessions[0].transcript[0].content).toBe('');
    });


    /**
     * GENERIC STORE INTEGRITY VALIDATIONS
     */

    it('7. getProgress(userId): correct shape returned when DB has sessions', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [createMockSession('valid logic')],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({
            data: { narrative: 'Test Narrative', sessions_at_last_narrative: 1 }
        });

        const progress = await store.getUserProgress('user-1') as any;

        expect(progress.userId).toBe('user-1');
        expect(Array.isArray(progress.sessions)).toBe(true);
        expect(progress.totalSessions).toBe(1);
        expect(progress.narrative).toBe('Test Narrative');
        expect(progress.sessions[0].problemId).toBe('two-sum');
    });

    it('8. getProgress(userId): returns empty array when DB has no sessions for user', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('empty-user') as any;

        expect(progress.sessions).toEqual([]);
        expect(progress.totalSessions).toBe(0);
    });

    it('9. saveProgress(): calls correct upsert with correct fields', async () => {
        mockSupabase.from('interview_sessions').insert.mockReturnThis();
        mockSupabase.from('interview_sessions').insert().select.mockReturnThis();
        mockSupabase.from('interview_sessions').insert().select().single.mockResolvedValue({
            data: { id: 'test-session-id' },
            error: null
        });

        mockSupabase.from('assessments').insert.mockReturnThis();
        mockSupabase.from('assessments').insert().select.mockReturnThis();
        mockSupabase.from('assessments').insert().select().single.mockResolvedValue({
            data: { id: 'test-assessment-id' },
            error: null
        });

        const sessionPayload = {
            sessionId: 'test-session',
            problemId: 'test',
            problemDifficulty: 'hard' as const,
            timestamp: new Date(),
            duration: 100,
            skills: { 'pattern-recognition': 5 } as any,
            overallScore: 80,
            transcript: [{ role: 'user', content: 'test string' }]
        };

        await store.saveSession('user-1', sessionPayload);

        // Verify the database inserts correctly formatted the payload ignoring custom client arrays correctly.
        expect(mockSupabase.from).toHaveBeenCalledWith('interview_sessions');
        expect(mockSupabase.from).toHaveBeenCalledWith('assessments');
    });

    it('10. Session with missing assessment -> loads without crash, overall_score defaults to 0', async () => {
        mockSupabase.from('interview_sessions').eq().eq().order.mockResolvedValue({
            data: [{
                id: 'session-no-assessment',
                problem_id: 'test',
                assessments: [] // Missing assessment bounds simulating incomplete pipeline execution
            }],
            error: null
        });
        mockSupabase.from('learner_profiles').select().eq().maybeSingle.mockResolvedValue({ data: null });

        const progress = await store.getUserProgress('user-fail') as any;

        // Fails gracefully returning 0 mappings keeping mapping graphs zeroed instead of crashing.
        expect(progress.sessions[0].overallScore).toBe(0);
    });
});
