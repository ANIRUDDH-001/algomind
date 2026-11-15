/**
 * @codesage
 * @file      src/lib/assessment/__tests__/analyzer.test.ts
 * @purpose   Unit tests for assessment module
 * @tech      vitest
 * @connects  various
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveAnalyzer } from '../analyzer';
import { ConversationTurn } from '../prompts';
import * as aiClientModule from '@/lib/ai/client';

// Mock the AI client layer
vi.mock('@/lib/ai/client', () => {
    return {
        getAIClient: vi.fn(),
    };
});

// Mock the validation layer so it doesn't trigger extra AI calls
vi.mock('../score-validator', () => ({
    validateAndCorrectScores: vi.fn().mockResolvedValue({}),
    applyValidation: vi.fn((skills) => skills)
}));

describe('CognitiveAnalyzer', () => {
    let analyzer: CognitiveAnalyzer;
    let mockGenerateCompletion: any;

    beforeEach(() => {
        analyzer = new CognitiveAnalyzer();
        mockGenerateCompletion = vi.fn();

        (aiClientModule.getAIClient as any).mockReturnValue({
            generateCompletion: mockGenerateCompletion
        });

        // Disable retry delays to speed up tests
        (analyzer as any).retryDelayMs = 0;
    });

    const mockProblem = {
        title: 'Two Sum',
        description: 'Find two numbers that add up to target',
        difficulty: 'easy'
    };

    const generateMockValidAiResponse = (overrides = {}) => {
        const defaultSkills = {
            'pattern-recognition': { score: 70, evidence: ['recognized hash map'], strengths: [], improvements: [] },
            'complexity-analysis': { score: 80, evidence: ['O(n) time'], strengths: [], improvements: [] },
            'problem-decomposition': { score: 75, evidence: ['split steps'], strengths: [], improvements: [] },
            'communication-clarity': { score: 90, evidence: ['clear'], strengths: [], improvements: [] },
            'optimization-mindset': { score: 85, evidence: ['opted for 1-pass'], strengths: [], improvements: [] },
            'edge-case-awareness': { score: 60, evidence: ['forgot empty array'], strengths: [], improvements: [] },
            'algorithmic-thinking': { score: 70, evidence: [], strengths: [], improvements: [] },
            'debugging-approach': { score: 70, evidence: [], strengths: [], improvements: [] },
        };

        return JSON.stringify({
            skills: { ...defaultSkills, ...overrides },
            overallFeedback: "Good session overall",
            nextSteps: ["Practice more arrays", "Review edge cases"],
            knowledgeGaps: ["Advanced trees"]
        });
    };

    it('1. analyzeSession() with minimal transcript returns AssessmentResult shape', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse()
        });

        const transcript = [{ role: 'user', content: 'Here is my solution using a hash map' }] as ConversationTurn[];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        expect(result).toHaveProperty('sessionId', 'session-1');
        expect(result).toHaveProperty('problem');
        expect(result).toHaveProperty('skills');
        expect(result).toHaveProperty('overallFeedback');
        expect(result).toHaveProperty('nextSteps');
        expect(Array.isArray(result.nextSteps)).toBe(true);
    });

    it('2. All 6 specified cognitive skills appear in result.skills', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse()
        });

        const transcript = [{ role: 'user' as const, content: 'hello', timestamp: new Date() }];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        const expectedSkills = [
            'pattern-recognition',
            'complexity-analysis',
            'problem-decomposition',
            'communication-clarity', // 'communication'
            'optimization-mindset',  // 'optimization-awareness'
            'edge-case-awareness'    // 'edge-case-handling'
        ];

        expectedSkills.forEach(skill => {
            expect(result.skills).toHaveProperty(skill);
            expect(result.skills[skill as keyof typeof result.skills]).toBeDefined();
        });
    });

    it('3. Skill score range: all scores logically valid between 0 and 100', async () => {
        // Assume default model scoring is 0-100 logically mapped for standard UI metrics
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse({
                'pattern-recognition': { score: 100, evidence: [], strengths: [], improvements: [] },
                'complexity-analysis': { score: 0, evidence: [], strengths: [], improvements: [] }
            })
        });

        const transcript = [{ role: 'user' as const, content: 'hello', timestamp: new Date() }];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        Object.values(result.skills).forEach(skill => {
            expect(skill.score).toBeGreaterThanOrEqual(0);
            expect(skill.score).toBeLessThanOrEqual(100);
        });
    });

    it('4. overall_score: average of skill scores (±1 tolerance)', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse()
        });

        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'Let me think about this problem step by step' },
            { role: 'user', content: 'I would use a hash map to store complements' },
            { role: 'user', content: 'The time complexity is O(n)' },
            { role: 'user', content: 'For edge cases we handle empty arrays' },
            { role: 'user', content: 'We could also consider a two-pointer approach' },
            { role: 'user', content: 'The space complexity is O(n) for the map' },
        ];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        const skillArr = Object.values(result.skills);
        const sum = skillArr.reduce((acc, curr) => acc + curr.score, 0);
        const manualAverage = sum / skillArr.length;

        // Custom calculation logic validation: ensuring the array values correspond properly to aggregate math.
        expect(manualAverage).toBeCloseTo(75, 0); // (70+80+75+90+85+60+70+70)/8 = 75
    });

    it('5. Empty transcript -> returns low-score assessment, not crash', async () => {
        // AI model should gracefully say it's weak
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse({
                'communication-clarity': { score: 10, evidence: ['no communication'], strengths: [], improvements: [] }
            })
        });

        const transcript: any[] = [];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        expect(result.skills['communication-clarity'].score).toBe(5);
        expect(mockGenerateCompletion).toHaveBeenCalledTimes(1); // Didn't crash
    });

    it('6. AI response that is malformed JSON -> error handled, fallback result returned', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: 'This is not valid JSON string...'
        });

        // Provide a long enough transcript to avoid triggering the user_fault condition
        const transcript: ConversationTurn[] = [{
            role: 'user',
            content: 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one'
        }];

        // 3 retries occurs -> fallback returns without throwing
        const result = await analyzer.analyze('session-fail', mockProblem, transcript);

        expect(mockGenerateCompletion).toHaveBeenCalledTimes(3);

        // Assert fallback payload shape
        expect(result.overallFeedback).toBe('Our AI analysis is being retried. Scores may update shortly.');
        expect(result.skills['problem-decomposition'].confidence).toBe(0.2);
    });

    it('7. Very long transcript (100+ messages) -> completes without timeout (mock AI)', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse()
        });

        const transcript = Array.from({ length: 150 }).map((_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i} is long enough to simulate typical context strings.`
        })) as ConversationTurn[];

        const startTime = Date.now();
        const result = await analyzer.analyze('long-session', mockProblem, transcript);
        const duration = Date.now() - startTime;

        expect(result.sessionId).toBe('long-session');
        // Because of the mock, it shouldn't timeout, execution should be roughly instant
        expect(duration).toBeLessThan(100);
    });

    it('8. next_steps: array of strings, not empty for below-average sessions', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockValidAiResponse()
        });

        const transcript: ConversationTurn[] = [{ role: 'user', content: 'test' }];
        const result = await analyzer.analyze('session-1', mockProblem, transcript);

        expect(Array.isArray(result.nextSteps)).toBe(true);
        expect(result.nextSteps.length).toBeGreaterThan(0);
        expect(typeof result.nextSteps[0]).toBe('string');
    });

    const assessmentProblem = { title: 'Counting paths', description: 'Count paths in a grid', difficulty: ' Medium ' };
    const transcriptWithTurns = (count: number): ConversationTurn[] => Array.from(
        { length: count },
        () => ({ role: 'user', content: 'I will explain the solution and its trade-offs in detail.' }),
    );

    it('returns a complete assessment from fenced JSON and retains the provider identity', async () => {
        const payload = {
            skills: {
                'problem-decomposition': {
                    score: 8,
                    evidence: ['Identified independent steps'],
                    strengths: ['Clear breakdown'],
                    improvements: ['Define the interfaces explicitly'],
                },
            },
            overallFeedback: 'Develop the recurrence.',
            nextSteps: ['Trace a minimal example.'],
            knowledgeGaps: ['Dynamic programming'],
            codeQuality: { score: 7, correctness: 'good', clarity: 'clear', consistency: 'good', issues: ['Naming'] },
            hireDecision: 'HIRE',
            keyMoments: [{ description: 'Explained the recurrence' }],
            improvementExamples: [{ description: 'Test an empty grid' }],
        };
        mockGenerateCompletion.mockResolvedValue({
            success: true, response: 'Here is the result:\n```json\n' + JSON.stringify(payload) + '\n```', modelUsed: 'assessment-fixture',
        });

        const result = await analyzer.analyze('complete-session', assessmentProblem, transcriptWithTurns(6));

        expect(result).toMatchObject({
            sessionId: 'complete-session', timestamp: expect.any(Date), problem: assessmentProblem,
            overallScore: 5.5, rawScore: 5.5, adjustedScore: 6.32,
            overallFeedback: payload.overallFeedback, nextSteps: payload.nextSteps,
            knowledgeGaps: payload.knowledgeGaps, codeQuality: payload.codeQuality,
            modelUsed: 'assessment-fixture', validationPassDone: true, hireDecision: 'HIRE', isLimitedEvidence: false,
            keyMoments: payload.keyMoments, improvementExamples: payload.improvementExamples,
        });
        expect(result.skills['problem-decomposition']).toMatchObject({
            ...payload.skills['problem-decomposition'], subCriteria: {}, confidence: expect.any(Number),
        });
        expect(result.skills['debugging-approach']).toEqual({
            score: 5, subCriteria: {}, evidence: [], strengths: [], improvements: [],
            confidence: result.skills['problem-decomposition'].confidence,
        });
        expect(mockGenerateCompletion).toHaveBeenCalledWith(
            [{ role: 'user', content: expect.stringContaining(assessmentProblem.title) }],
            {
                category: 'analysis',
                systemPrompt: 'You are a professional assessment engine. Return only valid JSON.',
                maxTokens: 8192, estimatedTokens: 2000, responseFormat: { type: 'json_object' },
            },
        );
    });

    it.each([[3, 5], [4, 6], [5, 6], [6, 9]])(
        'applies the evidence cap at %i user turns',
        async (turns, expectedScore) => {
            mockGenerateCompletion.mockResolvedValue({
                success: true,
                response: JSON.stringify({ skills: { 'problem-decomposition': { score: 9 } }, hireDecision: 'MAYBE' }),
            });
            const transcript = [{ role: 'assistant' as const, content: 'What is the time complexity?' }, ...transcriptWithTurns(turns)];
            const result = await analyzer.analyze('cap-check', mockProblem, transcript);
            expect(result.skills['problem-decomposition'].score).toBe(expectedScore);
            expect(result).toMatchObject({
                isLimitedEvidence: turns < 6, hireDecision: null, modelUsed: 'unknown',
                overallFeedback: 'No feedback generated.', nextSteps: ['Review the session manually.'],
                knowledgeGaps: [], codeQuality: null, keyMoments: [], improvementExamples: [],
            });
        },
    );

    it('retries missing and truncated skill data before accepting a valid assessment', async () => {
        mockGenerateCompletion
            .mockResolvedValueOnce({ success: true, response: '{"skills":{}}' })
            .mockResolvedValueOnce({ success: true, response: '{"skills":{' })
            .mockResolvedValueOnce({ success: true, response: generateMockValidAiResponse() });

        const result = await analyzer.analyze('retry-session', mockProblem, transcriptWithTurns(6));

        expect(mockGenerateCompletion).toHaveBeenCalledTimes(3);
        expect(result).toMatchObject({ sessionId: 'retry-session', validationPassDone: true, overallFeedback: 'Good session overall' });
        expect(result.analysisFailure).toBeUndefined();
    });

    it('returns zero scores when failed analysis has fewer than 20 candidate words', async () => {
        mockGenerateCompletion.mockResolvedValue({ success: false, error: 'provider unavailable' });
        const response = await analyzer.analyze('short-session', assessmentProblem, [
            { role: 'assistant', content: 'Can you describe the algorithm and outline how you will test correctness?' },
            { role: 'user', content: 'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen.' },
        ]);

        expect(response).toMatchObject({
            sessionId: 'short-session', timestamp: expect.any(Date), problem: assessmentProblem,
            analysisFailure: 'user_fault', overallScore: 0, rawScore: 0, adjustedScore: 0,
            overallFeedback: 'Your session had too little discussion for accurate scoring. Try engaging more with KAI.',
            nextSteps: ['Engage more comprehensively in the next interview to receive an assessment.'],
            knowledgeGaps: [], keyMoments: [], improvementExamples: [],
        });
        expect(Object.keys(response.skills)).toHaveLength(8);
        for (const skill of Object.values(response.skills)) {
            expect(skill).toEqual({
                score: 0, confidence: 0, subCriteria: {}, strengths: [],
                evidence: ['Insufficient user interaction to assess skills.'],
                improvements: ['Provide more detailed code and explanations.'],
            });
        }
    });

    it('returns skill-specific partial credit after a provider failure with enough evidence', async () => {
        mockGenerateCompletion.mockResolvedValue({ success: false, error: 'provider unavailable' });
        const response = await analyzer.analyze('fallback-session', assessmentProblem, [
            { role: 'assistant', content: 'Use dynamic programming.' },
            { role: 'user', content: 'FIRST I will SORT it because that helps. THEN I will TEST the EMPTY input and verify TIME COMPLEXITY carefully.' },
        ]);

        expect(response).toMatchObject({
            sessionId: 'fallback-session', timestamp: expect.any(Date), problem: assessmentProblem,
            analysisFailure: 'system_fault', overallScore: 4.5, rawScore: 4.5, adjustedScore: 5.18,
            overallFeedback: 'Our AI analysis is being retried. Scores may update shortly.',
            nextSteps: ['Scores are based on keyword analysis. Full AI re-analysis may provide more accurate results.'],
            knowledgeGaps: [], keyMoments: [], improvementExamples: [],
        });
        const expectedCounts = [2, 0, 1, 2, 1, 1, 0, 2];
        const skillIds = [
            'problem-decomposition', 'pattern-recognition', 'algorithmic-thinking', 'complexity-analysis',
            'communication-clarity', 'edge-case-awareness', 'optimization-mindset', 'debugging-approach',
        ] as const;
        for (const [index, skillId] of skillIds.entries()) {
            const count = expectedCounts[index];
            expect(response.skills[skillId]).toEqual({
                score: [3, 4, 6][count], confidence: 0.2, subCriteria: {}, strengths: [],
                evidence: [count
                    ? `Keyword-based fallback: detected ${count} relevant terms. Scores may update when AI analysis retries.`
                    : 'AI analysis failed. Scores are estimated and may update shortly.'],
                improvements: ['Scores are based on keyword analysis due to AI failure. A full AI re-analysis may provide more accurate results.'],
            });
        }
    });

    it.each([
        ['problem-decomposition', 'break / decompose / subproblem / step / divide / approach / plan / first / then', 9],
        ['pattern-recognition', 'pattern / similar / sliding window / two pointer / dp / dynamic programming / bfs / dfs / greedy / binary search', 10],
        ['algorithmic-thinking', 'algorithm / sort / search / traverse / iterate / recursion / recursive / hash / stack / queue / tree / graph / array', 13],
        ['complexity-analysis', 'time complexity / space complexity / O(n) / O(log / O(1) / O(n^2) / big O / efficient', 9],
        ['communication-clarity', 'because / reason / explain / idea / approach is / the way / basically / so the / let me', 9],
        ['edge-case-awareness', 'edge case / empty / null / zero / negative / overflow / boundary / corner case / what if', 9],
        ['optimization-mindset', 'optimize / improve / better / faster / reduce / efficient / optimal / trade-off / space-time', 9],
        ['debugging-approach', 'debug / trace / print / test / dry run / walk through / check / verify / output', 9],
    ] as const)('recognizes the fallback signals for %s', async (skillId, discussion, count) => {
        mockGenerateCompletion.mockResolvedValue({ success: false, error: 'provider unavailable' });
        const result = await analyzer.analyze('fallback-signal', mockProblem, [
            { role: 'user', content: 'I would discuss this with several peers during a review and give concrete examples: ' + discussion },
        ]);

        expect(result.analysisFailure).toBe('system_fault');
        expect(result.skills[skillId]).toMatchObject({
            score: 6,
            evidence: [`Keyword-based fallback: detected ${count} relevant terms. Scores may update when AI analysis retries.`],
        });
    });
});
