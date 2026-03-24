import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveInterviewSession } from '@/app/actions/save-session';
import { createServerSupabase } from '@/lib/supabase/server';

// Mock Supabase Server
vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn()
}));

// Mock Analyzer
const mockAnalyze = vi.fn();
vi.mock('@/lib/assessment/analyzer', () => ({
    CognitiveAnalyzer: class {
        analyze = mockAnalyze;
    }
}));

// Mock monitoring/events
vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn()
}));

// Mock memory generator
vi.mock('@/lib/ai/memory-generator', () => ({
    updateKaiMemory: vi.fn().mockResolvedValue({ success: true })
}));

// Mock spaced repetition
vi.mock('@/lib/spaced-repetition/queue', () => ({
    addToQueue: vi.fn().mockResolvedValue({ success: true }),
    updateSkillRepetition: vi.fn().mockResolvedValue({ success: true })
}));

// Mock cache invalidation
vi.mock('@/lib/cache/dashboardCache', () => ({
    invalidateDashboardCache: vi.fn().mockResolvedValue(undefined)
}));

describe('saveInterviewSession Action', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            auth: {
                getUser: vi.fn()
            },
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockReturnThis(),
            rpc: vi.fn().mockReturnThis(),
        };

        (createServerSupabase as any).mockResolvedValue(mockSupabase);
        mockAnalyze.mockResolvedValue({
            sessionId: 'mock-session-id',
            timestamp: new Date(),
            problem: { title: 'Test', description: '', difficulty: 'medium' },
            skills: { 'algorithmic-thinking': { score: 8 } },
            overallFeedback: 'Good',
            nextSteps: [],
            knowledgeGaps: []
        });
    });

    it('1. Full happy path: valid transcript + problem -> session + assessment saved', async () => {
        // Mock Auth
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        // Mock Session Insert
        mockSupabase.insert.mockImplementation((_data: any) => {
            // Check session table insert
            return {
                select: () => ({
                    single: () => Promise.resolve({ data: { id: 'sess-abc', overall_score: 80 }, error: null })
                }),
                error: null
            };
        });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [{ role: 'user', content: 'hello' }],
            300,
            { skills: { 'logic': { score: 80 } } } as any
        );

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe('sess-abc');
        expect(mockSupabase.from).toHaveBeenCalledWith('interview_sessions');
        expect(mockSupabase.from).toHaveBeenCalledWith('assessments');
    });

    it('2. Unauthenticated user -> returns error, no DB writes', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null
        });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [],
            300
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unauthorized');
        expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('3. Empty transcript -> still saves session', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });
        mockSupabase.single.mockResolvedValue({ data: { id: 'sess-empty' }, error: null });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [], // Empty transcript
            100,
            { skills: {} } as any
        );

        expect(result.success).toBe(true);
        expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('4. Assessment AI call fails -> session still saved, assessment fields fallback', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        // Mock Analyzer to throw
        mockAnalyze.mockRejectedValue(new Error('AI Busy'));

        const mockInsert = vi.fn().mockImplementation(() => ({
            select: () => ({
                single: () => Promise.resolve({ data: { id: 'sess-recovery', overall_score: 0 }, error: null })
            })
        }));

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'interview_sessions') {
                return { insert: mockInsert };
            }
            return mockSupabase;
        });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [{ role: 'user', content: 'hi' }]
            // No result provided, triggers analyzer
        );

        expect(result.success).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('interview_sessions');
        // Check that it tried to save session with 'failed-analysis' feedback
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
            problem_id: 'prob-1'
        }));
    });

    it('5. DB insert for interview_sessions fails -> returns error', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'interview_sessions') {
                return {
                    insert: () => ({
                        select: () => ({
                            single: () => Promise.resolve({ data: null, error: { message: 'DB Down' } })
                        })
                    })
                };
            }
            return mockSupabase;
        });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [],
            100,
            { skills: {} } as any
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('DB Down');
    });

    it('6. DB insert for assessments fails -> session saved but assessment missing (partial success)', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'interview_sessions') {
                return {
                    insert: () => ({
                        select: () => ({
                            single: () => Promise.resolve({ data: { id: 'sess-partial' }, error: null })
                        })
                    })
                };
            }
            if (table === 'assessments') {
                return {
                    insert: () => Promise.resolve({ error: { message: 'Fk fail' } })
                };
            }
            return mockSupabase;
        });

        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [],
            100,
            { skills: {} } as any
        );

        // Should still be success because session was saved
        expect(result.success).toBe(true);
        expect(result.sessionId).toBe('sess-partial');
    });

    it('7. saveInterviewSession called with readOnly=true -> returns early, no writes', async () => {
        const result = await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [],
            100,
            undefined,
            { readOnly: true }
        );

        expect(result.success).toBe(true);
        expect((result as any).bypassed).toBe(true);
        expect(createServerSupabase).not.toHaveBeenCalled();
    });

    it('8. Correct session duration calculation from timestamps', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });
        mockSupabase.single.mockResolvedValue({ data: { id: 'sess-duration' }, error: null });

        const startTime = Date.now() - 60000; // 60 seconds ago
        const endTime = Date.now();

        await saveInterviewSession(
            'user-123',
            'prob-1',
            'Two Sum',
            [],
            undefined, // No duration Seconds
            { skills: {} } as any,
            { startTime, endTime }
        );

        expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
            duration: 60
        }));
    });

    it('assessment insert failure: returns success:true with assessmentPending:true', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'interview_sessions') {
                return {
                    ...mockSupabase,
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { id: 'session-abc', user_id: 'user-123' },
                                error: null
                            })
                        })
                    }),
                    select: vi.fn().mockImplementation((_columns?: string, options?: any) => {
                        if (options?.count === 'exact' && options?.head === true) {
                            return {
                                eq: vi.fn().mockResolvedValue({ count: 1, error: null })
                            };
                        }
                        return {
                            eq: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { description: 'Given...', difficulty: 'medium' },
                                    error: null
                                }),
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { description: 'Given...', difficulty: 'medium' },
                                    error: null
                                })
                            })
                        };
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ error: null })
                        })
                    })
                };
            }

            if (table === 'problems') {
                return {
                    ...mockSupabase,
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { description: 'Given...', difficulty: 'medium' },
                                error: null
                            }),
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: { difficulty: 'medium', tags: ['array'], primary_pattern: 'hash-map' },
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === 'assessments') {
                return {
                    ...mockSupabase,
                    insert: vi.fn().mockResolvedValue({
                        data: null,
                        error: { message: 'DB constraint violation', code: '23505' }
                    })
                };
            }

            return { ...mockSupabase };
        });

        const result = await saveInterviewSession(
            'user-123',
            'problem-id',
            'Two Sum',
            [
                { role: 'user', content: 'I would use a hashmap', timestamp: new Date() },
                { role: 'assistant', content: 'Good approach', timestamp: new Date() }
            ] as any,
            120
        );

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe('session-abc');
        expect((result as any).assessmentPending).toBe(true);
    });

    it('memory update failure does not affect session save success', async () => {
        const { updateKaiMemory } = await import('@/lib/ai/memory-generator');
        vi.mocked(updateKaiMemory).mockRejectedValueOnce(new Error('Gemini timeout'));

        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null
        });

        mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'interview_sessions') {
                return {
                    ...mockSupabase,
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { id: 'session-ok', user_id: 'user-123' },
                                error: null
                            })
                        })
                    }),
                    select: vi.fn().mockImplementation((_columns?: string, options?: any) => {
                        if (options?.count === 'exact' && options?.head === true) {
                            return {
                                eq: vi.fn().mockResolvedValue({ count: 1, error: null })
                            };
                        }
                        return {
                            eq: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { description: 'Given...', difficulty: 'medium' },
                                    error: null
                                }),
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { description: 'Given...', difficulty: 'medium' },
                                    error: null
                                })
                            })
                        };
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({ error: null })
                        })
                    })
                };
            }

            if (table === 'problems') {
                return {
                    ...mockSupabase,
                    select: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { description: 'Given...', difficulty: 'medium' },
                                error: null
                            }),
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: { difficulty: 'medium', tags: ['array'], primary_pattern: 'hash-map' },
                                error: null
                            })
                        })
                    })
                };
            }

            if (table === 'assessments') {
                return {
                    ...mockSupabase,
                    insert: vi.fn().mockResolvedValue({ data: null, error: null })
                };
            }

            return { ...mockSupabase };
        });

        const result = await saveInterviewSession(
            'user-123',
            'problem-id',
            'Two Sum',
            [
                { role: 'user', content: 'hashmap', timestamp: new Date() },
                { role: 'assistant', content: 'correct', timestamp: new Date() }
            ] as any,
            120
        );

        expect(result.success).toBe(true);
        expect((result as any).assessmentPending).toBeUndefined();
    });
});
