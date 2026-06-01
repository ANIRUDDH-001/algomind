/**
 * @codesage
 * @file      src/lib/assessment/__tests__/hire-decision.test.ts
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
import * as aiClientModule from '@/lib/ai/client';
import { ConversationTurn } from '../prompts';

describe('hire decision parsing in analyzer', () => {
    const mockGenerateCompletion = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(aiClientModule, 'getAIClient').mockReturnValue({
            generateCompletion: mockGenerateCompletion,
        } as any);
    });

    const mockProblem = { title: 'Two Sum', description: 'Find two numbers that add up to target', difficulty: 'easy' };
    const mockTranscript: ConversationTurn[] = [
        { role: 'assistant', content: 'Hello, how would you solve this?' },
        { role: 'user', content: 'I would use a hash map to achieve O(n) time complexity.' }
    ];

    const generateMockAIResponse = (hireDecisionValue: string | undefined) => {
        return JSON.stringify({
            skills: {
                'problem-decomposition': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'pattern-recognition': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'algorithmic-thinking': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'complexity-analysis': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'communication-clarity': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'edge-case-awareness': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'optimization-mindset': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] },
                'debugging-approach': { score: 8, subCriteria: {}, evidence: [], strengths: [], improvements: [] }
            },
            overallFeedback: 'Good job',
            nextSteps: [],
            hireDecision: hireDecisionValue
        });
    };

    it('extracts valid hireDecision from AI output', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockAIResponse('STRONG_HIRE')
        });

        const analyzer = new CognitiveAnalyzer();
        const result = await analyzer.analyze('sess-1', mockProblem, mockTranscript);
        expect(result.hireDecision).toBe('STRONG_HIRE');
    });

    it('sets hireDecision to null when it is missing from AI output', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockAIResponse(undefined)
        });

        const analyzer = new CognitiveAnalyzer();
        const result = await analyzer.analyze('sess-2', mockProblem, mockTranscript);
        expect(result.hireDecision).toBeNull();
    });

    it('sets hireDecision to null when AI outputs an invalid value', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: generateMockAIResponse('MAYBE_HIRE')
        });

        const analyzer = new CognitiveAnalyzer();
        const result = await analyzer.analyze('sess-3', mockProblem, mockTranscript);
        expect(result.hireDecision).toBeNull();
    });
});
