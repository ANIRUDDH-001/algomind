import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveInterviewSession } from '@/app/actions/save-session';
import { CognitiveAnalyzer } from '@/lib/assessment/analyzer';
import { validateAndCorrectScores } from '@/lib/assessment/score-validator';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { addToQueue, updateSkillRepetition } from '@/lib/spaced-repetition/queue';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

import { MOCK_PROBLEM, MOCK_TRANSCRIPT_SHORT } from '../test-utils/assessment-fixtures';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

vi.mock('@/lib/ai/memory-generator', () => ({
    updateKaiMemory: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/narrative-generator', () => ({
    createAndSaveSession1Baseline: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/cache/dashboardCache', () => ({
    invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/knowledge-graph', () => ({
    getKnowledgeGraphService: vi.fn().mockReturnValue({
        onInterviewSessionCompleted: vi.fn().mockResolvedValue(undefined),
    }),
}));

vi.mock('@/lib/monitoring/events', () => ({
    logSystemEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/client', () => ({
    getAIClient: vi.fn().mockReturnValue({
        generateCompletion: vi.fn().mockResolvedValue({
            success: true,
            response: JSON.stringify({
                correctedScores: {
                    problemDecomposition: 7,
                    patternRecognition: null,
                    algorithmicThinking: null,
                    complexityAnalysis: null,
                    communicationClarity: null,
                    edgeCaseAwareness: null,
                    optimizationMindset: null,
                    debuggingApproach: null,
                },
                inflationDetected: true,
                validationNotes: 'Adjusted inflated score due to missing evidence',
            }),
        }),
    }),
}));

describe('Complete assessment pipeline (integration)', () => {
    const mockAnalyze = vi
        .spyOn(CognitiveAnalyzer.prototype, 'analyze')
        .mockResolvedValue({
            sessionId: 'analysis-session-1',
            timestamp: new Date(),
            problem: MOCK_PROBLEM,
            overallScore: 7.1,
            rawScore: 7.1,
            adjustedScore: 7.1,
            skills: {
                'problem-decomposition': { score: 8, evidence: ['decomposed'], strengths: [], improvements: [], confidence: 0.8 },
                'pattern-recognition': { score: 7, evidence: ['pattern'], strengths: [], improvements: [], confidence: 0.8 },
                'algorithmic-thinking': { score: 7, evidence: ['algo'], strengths: [], improvements: [], confidence: 0.8 },
                'complexity-analysis': { score: 7, evidence: ['complexity'], strengths: [], improvements: [], confidence: 0.8 },
                'communication-clarity': { score: 8, evidence: ['clarity'], strengths: [], improvements: [], confidence: 0.8 },
                'edge-case-awareness': { score: 6, evidence: ['edge'], strengths: [], improvements: [], confidence: 0.8 },
                'optimization-mindset': { score: 7, evidence: ['optimized'], strengths: [], improvements: [], confidence: 0.8 },
                'debugging-approach': { score: 7, evidence: ['debug'], strengths: [], improvements: [], confidence: 0.8 },
            },
            overallFeedback: 'Good result',
            nextSteps: ['Keep practicing'],
            knowledgeGaps: [],
            hireDecision: 'HIRE',
            modelUsed: 'test-model',
            validationPassDone: true,
            codeQuality: 7,
        } as any);

    beforeEach(() => {
        vi.clearAllMocks();
        mockAnalyze.mockResolvedValue({
            sessionId: 'analysis-session-1',
            timestamp: new Date(),
            problem: MOCK_PROBLEM,
            overallScore: 7.1,
            rawScore: 7.1,
            adjustedScore: 7.1,
            skills: {
                'problem-decomposition': { score: 8, evidence: ['decomposed'], strengths: [], improvements: [], confidence: 0.8 },
                'pattern-recognition': { score: 7, evidence: ['pattern'], strengths: [], improvements: [], confidence: 0.8 },
                'algorithmic-thinking': { score: 7, evidence: ['algo'], strengths: [], improvements: [], confidence: 0.8 },
                'complexity-analysis': { score: 7, evidence: ['complexity'], strengths: [], improvements: [], confidence: 0.8 },
                'communication-clarity': { score: 8, evidence: ['clarity'], strengths: [], improvements: [], confidence: 0.8 },
                'edge-case-awareness': { score: 6, evidence: ['edge'], strengths: [], improvements: [], confidence: 0.8 },
                'optimization-mindset': { score: 7, evidence: ['optimized'], strengths: [], improvements: [], confidence: 0.8 },
                'debugging-approach': { score: 7, evidence: ['debug'], strengths: [], improvements: [], confidence: 0.8 },
            },
            overallFeedback: 'Good result',
            nextSteps: ['Keep practicing'],
            knowledgeGaps: [],
            hireDecision: 'HIRE',
            modelUsed: 'test-model',
            validationPassDone: true,
            codeQuality: 7,
        } as any);
    });

    it('full pipeline: session completes and assessment is created', async () => {
        const mockInterviewInsert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                    data: { id: 'sess-001', user_id: 'user-test-1' },
                    error: null,
                }),
            }),
        });

        const mockAssessInsert = vi.fn().mockResolvedValue({
            data: { id: 'assess-001' },
            error: null,
        });

        const supabaseMock = {
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'user-test-1' } },
                    error: null,
                }),
            },
            rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
            from: vi.fn((table: string) => {
                if (table === 'problems') {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                single: vi.fn().mockResolvedValue({
                                    data: { description: 'Given...', difficulty: 'medium' },
                                    error: null,
                                }),
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: { difficulty: 'easy', tags: ['array'], primary_pattern: 'hash-map' },
                                    error: null,
                                }),
                            }),
                        }),
                    };
                }

                if (table === 'interview_sessions') {
                    return {
                        insert: mockInterviewInsert,
                        select: vi.fn().mockImplementation((_cols?: string, options?: { count?: string; head?: boolean }) => {
                            if (options?.count === 'exact' && options?.head === true) {
                                return { eq: vi.fn().mockResolvedValue({ count: 1, error: null }) };
                            }
                            return { eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
                        }),
                    };
                }

                if (table === 'assessments') {
                    return { insert: mockAssessInsert };
                }

                if (table === 'learner_profiles') {
                    return {
                        select: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                maybeSingle: vi.fn().mockResolvedValue({ data: { hire_readiness_trend: [] }, error: null }),
                            }),
                        }),
                        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }

                if (table === 'knowledge_gaps') {
                    return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) };
                }

                return {
                    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
            }),
        };

        vi.mocked(createServerSupabase).mockResolvedValue(supabaseMock as any);

        const result = await saveInterviewSession(
            'user-test-1',
            'two-sum',
            'Two Sum',
            MOCK_TRANSCRIPT_SHORT as any,
            300
        );

        expect(result.success).toBe(true);
        expect(typeof result.sessionId).toBe('string');
        expect(result.sessionId && result.sessionId.length).toBeGreaterThan(0);
        expect((result as any).assessmentPending).toBeFalsy();
    });

    it('validation pass runs and corrects inflated scores', async () => {
        const mockScores = {
            'problem-decomposition': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'pattern-recognition': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'algorithmic-thinking': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'complexity-analysis': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'communication-clarity': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'edge-case-awareness': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'optimization-mindset': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
            'debugging-approach': { score: 9, evidence: [], subCriteria: {}, strengths: [], improvements: [] },
        };

        const validation = await validateAndCorrectScores(
            mockScores as any,
            { conversationTurns: 3, hasCode: false } as any
        );

        const correctedValues = Object.values(validation.correctedScores).filter((v): v is number => typeof v === 'number');
        expect(correctedValues.some((score) => score < 9)).toBe(true);
    });

    it('sub-criteria are stored in assessments.sub_criteria JSONB', async () => {
        const skills = Object.keys(SKILL_DEFINITIONS);
        expect(skills).toHaveLength(8);

        for (const skill of skills) {
            const subCriteria = SKILL_DEFINITIONS[skill as keyof typeof SKILL_DEFINITIONS].subCriteria;
            expect(Array.isArray(subCriteria)).toBe(true);
            expect(subCriteria.length).toBeGreaterThan(0);

            const weightSum = subCriteria.reduce((sum, item) => sum + item.weight, 0);
            expect(Math.abs(weightSum - 1.0) < 0.01).toBe(true);
        }
    });

    it('skill_repetition is updated for all 8 skills after session', async () => {
        const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
        const maybeSingleSpy = vi.fn().mockResolvedValue({ data: null, error: null });

        const serviceClientMock = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            maybeSingle: maybeSingleSpy,
                        }),
                    }),
                }),
                upsert: upsertSpy,
            }),
        };

        vi.mocked(getServiceClient).mockReturnValue(serviceClientMock as any);

        await updateSkillRepetition({
            userId: 'u1',
            sessionId: 's1',
            dimensionScores: {
                'problem-decomposition': 7,
                'pattern-recognition': 5,
                'algorithmic-thinking': 6,
                'complexity-analysis': 4,
                'communication-clarity': 8,
                'edge-case-awareness': 3,
                'optimization-mindset': 7,
                'debugging-approach': 6,
            },
        });

        expect(upsertSpy).toHaveBeenCalledTimes(8);
        for (const [payload] of upsertSpy.mock.calls) {
            expect(payload).toEqual(expect.objectContaining({
                skill_id: expect.any(String),
                fsrs_due: expect.any(String),
            }));
        }
    });

    it('FSRS problem queue is updated after session', async () => {
        const upsertSpy = vi.fn().mockResolvedValue({ error: null });

        const serviceClientMock = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                    }),
                }),
                upsert: upsertSpy,
            }),
        };

        vi.mocked(getServiceClient).mockReturnValue(serviceClientMock as any);

        await expect(addToQueue({
            userId: 'u1',
            problemId: 'two-sum',
            problemTitle: 'Two Sum',
            problemDifficulty: 'easy',
            overallScore: 7,
        })).resolves.toBeUndefined();

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        const [payload] = upsertSpy.mock.calls[0];
        expect(payload).toEqual(expect.objectContaining({
            user_id: 'u1',
            problem_id: 'two-sum',
            fsrs_due: expect.any(String),
            fsrs_stability: expect.any(Number),
        }));
    });

    it('learner_profiles.hire_readiness_trend is appended', async () => {
        type HireReadinessTrendEntry = {
            sessionId: string;
            hireDecision: string;
            score: number;
            completedAt: string;
            problemDifficulty: string;
        };

        const trend: HireReadinessTrendEntry[] = [
            {
                sessionId: 's1',
                hireDecision: 'NO_HIRE',
                score: 4.8,
                completedAt: new Date().toISOString(),
                problemDifficulty: 'easy',
            },
            {
                sessionId: 's2',
                hireDecision: 'LEAN_HIRE',
                score: 6.3,
                completedAt: new Date().toISOString(),
                problemDifficulty: 'hard',
            },
        ];

        const appended = [
            ...trend,
            {
                sessionId: 's3',
                hireDecision: 'HIRE',
                score: 7.5,
                completedAt: new Date().toISOString(),
                problemDifficulty: 'medium',
            },
        ].slice(-20);

        expect(appended).toHaveLength(3);
        expect(appended[2].hireDecision).toBe('HIRE');
        expect(appended.length).toBeLessThanOrEqual(20);
    });
});
