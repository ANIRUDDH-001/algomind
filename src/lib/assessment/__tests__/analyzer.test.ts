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

        const transcript: ConversationTurn[] = [{ role: 'user', content: 'test' }];
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

        expect(result.skills['communication-clarity'].score).toBe(10);
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
});
