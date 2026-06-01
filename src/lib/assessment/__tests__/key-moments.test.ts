/**
 * @codesage
 * @file      src/lib/assessment/__tests__/key-moments.test.ts
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
import { extractKeyMoments } from '../key-moments';

// Shared mock fn so test and module access the same instance
const mockGenerateCompletion = vi.fn();

vi.mock('@/lib/ai/client', () => ({
    getAIClient: () => ({
        generateCompletion: mockGenerateCompletion,
    }),
}));

const MOCK_TRANSCRIPT = [
    { speaker: 'assistant', text: 'Can you tell me your approach to this two-sum problem?' },
    { speaker: 'user', text: 'I would start by using a hash map to store seen values.' },
    { speaker: 'assistant', text: 'Good. What about the time complexity?' },
    { speaker: 'user', text: 'The time complexity is O(n) because we iterate once through the array.' },
    { speaker: 'assistant', text: 'What about edge cases?' },
    { speaker: 'user', text: 'We should handle empty arrays and duplicate values.' },
    { speaker: 'assistant', text: 'Can you optimize further?' },
    { speaker: 'user', text: 'Actually, wait, I realize we could use two pointers if sorted, which is more space efficient.' },
];

const VALID_AI_RESPONSE = JSON.stringify([
    { momentType: 'approach_identified', quote: 'I would start by using a hash map...', significance: 'Candidate immediately identified optimal data structure.', dimension: 'algorithmic-thinking', sentiment: 'positive' },
    { momentType: 'complexity_explained', quote: 'The time complexity is O(n) because...', significance: 'Clear understanding of time complexity analysis.', dimension: 'complexity-analysis', sentiment: 'positive' },
    { momentType: 'self_correction', quote: 'Actually, wait, I realize we could...', significance: 'Self-correction shows growth mindset and optimization awareness.', dimension: 'optimization-mindset', sentiment: 'positive' },
    { momentType: 'missed_opportunity', quote: 'We should handle empty arrays...', significance: 'Surface-level edge case identification without deeper analysis.', dimension: 'edge-case-awareness', sentiment: 'negative' },
    { momentType: 'stuck_point', quote: 'Can you optimize further?', significance: 'Needed prompting to consider optimization.', dimension: null, sentiment: 'neutral' },
]);

describe('extractKeyMoments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty array for transcript with < 4 turns', async () => {
        const result = await extractKeyMoments([
            { speaker: 'assistant', text: 'Hello' },
            { speaker: 'user', text: 'Hi' },
        ]);
        expect(result).toEqual([]);
    });

    it('returns array of 5-7 items for normal transcript', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: VALID_AI_RESPONSE,
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.length).toBeLessThanOrEqual(7);
    });

    it('all moments have valid momentType from enum', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: VALID_AI_RESPONSE,
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        const validTypes = [
            'approach_identified', 'optimization_transition', 'self_correction',
            'complexity_explained', 'impressive_statement', 'missed_opportunity', 'stuck_point',
        ];
        for (const m of result) {
            expect(validTypes).toContain(m.momentType);
        }
    });

    it('quote length is <= 60 chars', async () => {
        const responseWithLongQuote = JSON.stringify([
            {
                momentType: 'approach_identified',
                quote: 'This is a very long quote that definitely exceeds the sixty character limit that we set for quotes in key moments extraction',
                significance: 'Test significance.',
                dimension: null,
                sentiment: 'positive',
            },
        ]);
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: responseWithLongQuote,
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        for (const m of result) {
            expect(m.quote.length).toBeLessThanOrEqual(60);
        }
    });

    it('sentiment is positive|negative|neutral', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: VALID_AI_RESPONSE,
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        for (const m of result) {
            expect(['positive', 'negative', 'neutral']).toContain(m.sentiment);
        }
    });

    it('returns empty array gracefully when AI fails', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: false,
            error: 'AI service unavailable',
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        expect(result).toEqual([]);
    });

    it('dimension is null or valid CognitiveSkill', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: VALID_AI_RESPONSE,
        });

        const validDimensions = [
            'problem-decomposition', 'pattern-recognition', 'algorithmic-thinking',
            'complexity-analysis', 'communication-clarity', 'edge-case-awareness',
            'optimization-mindset', 'debugging-approach', null,
        ];

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        for (const m of result) {
            expect(validDimensions).toContain(m.dimension);
        }
    });

    it('returns empty array for null transcript', async () => {
        const result = await extractKeyMoments(null as any);
        expect(result).toEqual([]);
    });

    it('filters out moments with invalid momentType', async () => {
        const responseWithInvalid = JSON.stringify([
            { momentType: 'invalid_type', quote: 'Test', significance: 'Test.', dimension: null, sentiment: 'positive' },
            { momentType: 'approach_identified', quote: 'Valid', significance: 'Valid.', dimension: null, sentiment: 'positive' },
        ]);
        mockGenerateCompletion.mockResolvedValueOnce({
            success: true,
            response: responseWithInvalid,
        });

        const result = await extractKeyMoments(MOCK_TRANSCRIPT);
        expect(result.length).toBe(1);
        expect(result[0].momentType).toBe('approach_identified');
    });
});
