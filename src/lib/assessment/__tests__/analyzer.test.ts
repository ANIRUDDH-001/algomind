import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveAnalyzer } from '../analyzer';
import { extractEvidence } from '../evidence-extractor';
import { getAIClient } from '@/lib/ai/client';

// Mock dependencies
vi.mock('@/lib/ai/client', () => ({
    getAIClient: vi.fn()
}));

// Mock Data
const mockValidResponse = {
    skills: {
        'problem-decomposition': { score: 8, evidence: [], strengths: [], improvements: [] },
        'pattern-recognition': { score: 7, evidence: [], strengths: [], improvements: [] },
        'algorithmic-thinking': { score: 6, evidence: [], strengths: [], improvements: [] },
        'complexity-analysis': { score: 5, evidence: [], strengths: [], improvements: [] },
        'communication-clarity': { score: 9, evidence: [], strengths: [], improvements: [] },
        'edge-case-awareness': { score: 4, evidence: [], strengths: [], improvements: [] },
        'optimization-mindset': { score: 3, evidence: [], strengths: [], improvements: [] },
        'debugging-approach': { score: 2, evidence: [], strengths: [], improvements: [] }
    },
    overallFeedback: "Good job",
    nextSteps: ["Practice more"],
    knowledgeGaps: []
};

describe('CognitiveAnalyzer', () => {
    let analyzer: CognitiveAnalyzer;
    const mockGenerateCompletion = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        analyzer = new CognitiveAnalyzer();
        // Mock the retry delay to be 0 for faster tests
        (analyzer as any).retryDelayMs = 0;

        (getAIClient as any).mockReturnValue({
            generateCompletion: mockGenerateCompletion
        });
    });

    describe('parseResponse', () => {
        it('should parse valid JSON response correctly', () => {
            const jsonStr = JSON.stringify(mockValidResponse);
            const result = (analyzer as any).parseResponse(jsonStr);
            expect(result).toEqual(mockValidResponse);
        });

        it('should parse response wrapped in markdown code block', () => {
            const jsonStr = `\`\`\`json\n${JSON.stringify(mockValidResponse)}\n\`\`\``;
            const result = (analyzer as any).parseResponse(jsonStr);
            expect(result).toEqual(mockValidResponse);
        });

        it('should throw on malformed JSON', () => {
            const malformed = "not json at all";
            expect(() => (analyzer as any).parseResponse(malformed)).toThrow(/Assessment parse failed/);
        });
    });

    describe('analyze', () => {
        const mockSessionId = 'test-session';
        const mockProblem = { title: 'Test', description: 'Desc', difficulty: 'Easy' };
        const mockTranscript = [{ role: 'user', content: 'hello', timestamp: 0 }];

        it('should retries on failure and eventually succeed', async () => {
            // 1. Network failure
            mockGenerateCompletion.mockResolvedValueOnce({ success: false, error: 'Network Error' });

            // 2. Parsable but invalid response (or empty) -> callAI logic checks success
            // If we want to simulate parse error, we return success: true but bad string
            mockGenerateCompletion.mockResolvedValueOnce({ success: true, response: 'invalid json' });

            // 3. Success
            mockGenerateCompletion.mockResolvedValueOnce({
                success: true,
                response: JSON.stringify(mockValidResponse)
            });

            const result = await analyzer.analyze(mockSessionId, mockProblem, mockTranscript as any);

            expect(result.sessionId).toBe(mockSessionId);
            expect(mockGenerateCompletion).toHaveBeenCalledTimes(3);
        });

        it('should throw after maxRetries', async () => {
            // Always fail
            mockGenerateCompletion.mockResolvedValue({ success: false, error: 'Persistent Failure' });

            await expect(analyzer.analyze(mockSessionId, mockProblem, mockTranscript as any))
                .rejects.toThrow(/Assessment failed after 3 attempts/);

            expect(mockGenerateCompletion).toHaveBeenCalledTimes(3);
        });
    });
});

describe('EvidenceExtractor', () => {
    it('should extract quotes from transcript based on keywords', () => {
        const transcript = [
            { role: 'user', content: 'I will break down the problem into steps.', timestamp: 1 }, // problem-decomposition
            { role: 'user', content: 'I need to sorting this array.', timestamp: 2 }, // algorithmic-thinking matches 'sorting'
            { role: 'assistant', content: 'Okay.', timestamp: 3 },
            { role: 'user', content: 'Wait, let me think.', timestamp: 4 }, // communications-clarity
            { role: 'user', content: 'Using a binary search here.', timestamp: 5 } // algorithmic-thinking matches 'binary'
        ];

        // "algorithmic-thinking" keywords: ['loop', 'iterate', 'stack', 'queue', 'sorting', 'binary']
        const quotes = extractEvidence(transcript as any, 'algorithmic-thinking');

        expect(quotes).toHaveLength(2);
        expect(quotes).toContain('I need to sorting this array.');
        expect(quotes).toContain('Using a binary search here.');
    });
});
