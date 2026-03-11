import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/learn/chat/route';
import { getAIClient } from '@/lib/ai/client';
import { getGlobalFeatureFlag } from '@/lib/feature-flags-server';
import { getKaiMemory, updateKaiMemory, recordLearnSession } from '../learn';
import { getServiceClient } from '@/lib/supabase/service';
import { createServerSupabase } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn()
}));

vi.mock('@/lib/feature-flags-server', () => ({
    getGlobalFeatureFlag: vi.fn()
}));

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

vi.mock('@/lib/ai/client', () => ({
    getAIClient: vi.fn(),
    UnifiedAIClient: vi.fn()
}));

const mockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { title: 'T', difficulty: 'easy', description: 'D', tags: [] }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
};

describe('Learn Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getServiceClient as any).mockReturnValue(mockSupabase);
        (createServerSupabase as any).mockResolvedValue(mockSupabase);

        // Reset mock implementations
        mockSupabase.maybeSingle.mockReset();
        mockSupabase.maybeSingle.mockResolvedValue({ data: { kai_memory: 'Existing', sessions_at_last_narrative: 3 }, error: null });
        mockSupabase.upsert.mockResolvedValue({ error: null });
        mockSupabase.insert.mockResolvedValue({ error: null });
        mockSupabase.single.mockResolvedValue({ data: { title: 'T', difficulty: 'easy', description: 'D', tags: [] }, error: null });
    });

    describe('Learn Chat API Route', () => {
        it('appends hinglish block when global flag ON and user preference ON', async () => {
            (getGlobalFeatureFlag as any).mockResolvedValue(true);
            
            // Order of maybeSingle calls in POST: lastSession (score), getKaiMemory (memory), user_preferences (hinglish)
            mockSupabase.maybeSingle
                .mockResolvedValueOnce({ data: { overall_score: 8 }, error: null })
                .mockResolvedValueOnce({ data: { kai_memory: 'Mock Mem', sessions_at_last_narrative: 3 }, error: null })
                .mockResolvedValueOnce({ data: { hinglish_enabled: true }, error: null });

            const mockGenerate = vi.fn().mockResolvedValue({ success: true, response: 'hi', modelUsed: 'x', provider: 'y' });
            (getAIClient as any).mockReturnValue({ generateResponse: mockGenerate });

            const req = new NextRequest('http://localhost/api/learn/chat', {
                method: 'POST',
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'mera approach dekho' }],
                    problemId: 'prob-1'
                })
            });

            const res = await POST(req);
            expect(res.status).toBe(200);

            const callArgs = mockGenerate.mock.calls[0];
            const options = callArgs[1];
            expect(options.systemPrompt).toContain('SPOKEN LANGUAGE: Candidate is speaking Hinglish');
        });
    });

    describe('getKaiMemory', () => {
        it('should return empty string if user not found natively', async () => {
            mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
            const mem = await getKaiMemory('user-123');
            expect(mem).toBe('');
            expect(mockSupabase.insert).toHaveBeenCalled();
        });

        it('should return existing memory if found', async () => {
            const mem = await getKaiMemory('user-123');
            expect(mem).toBe('Existing');
            expect(mockSupabase.from).toHaveBeenCalledWith('learner_profiles');
        });
    });

    describe('updateKaiMemory', () => {
        it('should append and truncate memory', async () => {
            const res = await updateKaiMemory('user-123', 'New Summary');
            expect(res.success).toBe(true);
            expect(mockSupabase.upsert).toHaveBeenCalled();

            const upsertArgs = mockSupabase.upsert.mock.calls[0][0];
            expect(upsertArgs.user_id).toBe('user-123');
            expect(upsertArgs.kai_memory).toContain('Existing');
            expect(upsertArgs.kai_memory).toContain('New Summary');
            expect(upsertArgs.sessions_at_last_narrative).toBe(4);
        });
    });

    describe('recordLearnSession', () => {
        it('should insert into system_events', async () => {
            const res = await recordLearnSession({
                userId: 'user-123',
                problemId: 'prob-456',
                conceptsCovered: ['Array'],
                duration: 600
            });
            expect(res.success).toBe(true);
            expect(mockSupabase.from).toHaveBeenCalledWith('system_events');
            expect(mockSupabase.insert).toHaveBeenCalled();

            const insertArgs = mockSupabase.insert.mock.calls[0][0];
            expect(insertArgs.type).toBe('learn_session_complete');
            expect(insertArgs.user_id).toBe('user-123');
        });
    });
});
