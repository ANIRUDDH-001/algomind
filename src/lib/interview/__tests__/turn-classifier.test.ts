import { vi, describe, it, expect, beforeEach } from 'vitest';
import { classifyTurnSignal } from '../turn-classifier';
import * as aiClientModule from '@/lib/ai/client';

describe('classifyTurnSignal', () => {
    const mockGenerateCompletion = vi.fn();

    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(aiClientModule, 'getAIClient').mockReturnValue({
            generateCompletion: mockGenerateCompletion,
        } as any);
    });

    it('returns null for messages under 20 chars', async () => {
        const result = await classifyTurnSignal('too short', 'Problem Title');
        expect(result).toBeNull();
        expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });

    it('returns complexity-analysis signal for "this is O(n log n) because we sort once then binary search"', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: JSON.stringify({
                dimension: 'complexity-analysis',
                confidence: 0.9,
                triggerPhrase: 'O(n log n) correctly identified'
            })
        });

        const result = await classifyTurnSignal(
            'this is O(n log n) because we sort once then binary search inside a loop',
            'Binary Search'
        );

        expect(result).toEqual({
            dimension: 'complexity-analysis',
            confidence: 0.9,
            triggerPhrase: 'O(n log n) correctly identified'
        });
    });

    it('returns edge-case-awareness for "what happens if the array is empty?"', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: JSON.stringify({
                dimension: 'edge-case-awareness',
                confidence: 0.85,
                triggerPhrase: 'Empty array edge case'
            })
        });

        const result = await classifyTurnSignal(
            'Wait, before we start writing the loop, what happens if the array is empty?',
            'Two Sum'
        );
        expect(result?.dimension).toBe('edge-case-awareness');
    });

    it('returns null for vague "I will use a loop"', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: JSON.stringify({
                dimension: null,
                confidence: 0
            })
        });

        const result = await classifyTurnSignal(
            'I will just use a loop to go through all the elements',
            'Two Sum'
        );
        expect(result).toBeNull();
    });

    it('returns optimization-mindset for "brute force is O(n²) but we can do O(n) with a hashmap"', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: JSON.stringify({
                dimension: 'optimization-mindset',
                confidence: 0.95,
                triggerPhrase: 'Proposed O(n) hashmap optimization'
            })
        });

        const result = await classifyTurnSignal(
            'The brute force is O(n²) but we can do O(n) with a hashmap to store seen values',
            'Two Sum'
        );
        expect(result?.dimension).toBe('optimization-mindset');
    });

    it('returns null when confidence < 0.75', async () => {
        mockGenerateCompletion.mockResolvedValue({
            success: true,
            response: JSON.stringify({
                dimension: 'algorithmic-thinking',
                confidence: 0.6,
                triggerPhrase: 'Weak signal'
            })
        });

        const result = await classifyTurnSignal(
            'I think we can sort it and then maybe use two pointers depending on the condition',
            'Two Sum'
        );
        expect(result).toBeNull();
    });

    it('does not throw on AI failure — returns null gracefully', async () => {
        mockGenerateCompletion.mockRejectedValue(new Error('Network failure'));

        const result = await classifyTurnSignal(
            'A perfectly good valid technical sentence that happens during an outage',
            'Two Sum'
        );
        expect(result).toBeNull();
    });
});
