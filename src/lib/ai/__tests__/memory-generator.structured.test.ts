import { generateStructuredKaiMemory, structuredToText } from '../memory-generator';
// @ts-expect-error -- automated unused local suppression
import { getAIClient, UnifiedAIClient } from '../client';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { KaiMemoryStructured } from '@/types/kai-memory';

vi.mock('../client', () => {
    return {
        UnifiedAIClient: vi.fn(),
        getAIClient: vi.fn()
    };
});

describe('generateStructuredKaiMemory', () => {
    let mockGenerateCompletion: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGenerateCompletion = vi.fn().mockResolvedValue({
            success: true,
            response: JSON.stringify({
                topStrength: { skill: 'pattern-recognition', evidence: 'Identified sliding window quickly' },
                mainWeakness: { skill: 'complexity-analysis', evidence: 'Forgot space complexity' },
                communicationStyle: 'structured',
                focusForNextSession: 'Push for edge cases earlier'
            })
        });

        vi.mocked(UnifiedAIClient).mockImplementation(function () {
            return {
                generateCompletion: mockGenerateCompletion
            } as any;
        } as any);
    });

    const mockSession = {
        sessionId: '123',
        problemTitle: 'Two Sum',
        problemDifficulty: 'easy' as const,
        overallScore: 8,
        completedAt: new Date().toISOString(),
        skills: {
            'pattern-recognition': 9,
            'complexity-analysis': 5
        }
    };

    it('returns existing memory if no recent sessions provided', async () => {
        const existing: KaiMemoryStructured = {
            topStrength: { skill: 'algorithmic-thinking', evidence: 'good' },
            mainWeakness: { skill: 'debugging-approach', evidence: 'bad' },
            communicationStyle: 'conversational',
            focusForNextSession: 'none'
        };

        const result = await generateStructuredKaiMemory({
            userId: 'test_user',
            recentSessions: [],
            existingMemory: existing
        });

        expect(result).toEqual(existing);
        expect(mockGenerateCompletion).not.toHaveBeenCalled();
    });

    it('generates a valid structural memory object', async () => {
        const result = await generateStructuredKaiMemory({
            userId: 'test_user',
            recentSessions: [mockSession],
            existingMemory: null
        });

        expect(result).toEqual({
            topStrength: { skill: 'pattern-recognition', evidence: 'Identified sliding window quickly' },
            mainWeakness: { skill: 'complexity-analysis', evidence: 'Forgot space complexity' },
            communicationStyle: 'structured',
            focusForNextSession: 'Push for edge cases earlier'
        });
        expect(mockGenerateCompletion).toHaveBeenCalled();
    });

    it('falls back to existing memory on AI failure', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({ success: false, error: 'API Error' });

        const existing: KaiMemoryStructured = {
            topStrength: { skill: 'algorithmic-thinking', evidence: 'good' },
            mainWeakness: { skill: 'debugging-approach', evidence: 'bad' },
            communicationStyle: 'conversational',
            focusForNextSession: 'none'
        };

        const result = await generateStructuredKaiMemory({
            userId: 'test_user',
            recentSessions: [mockSession],
            existingMemory: existing
        });

        expect(result).toEqual(existing);
    });

    describe('structuredToText', () => {
        it('formats the structured JSON into readable prose', () => {
            const memory: KaiMemoryStructured = {
                topStrength: { skill: 'pattern-recognition', evidence: 'Identified sliding window quickly' },
                mainWeakness: { skill: 'complexity-analysis', evidence: 'Forgot space complexity' },
                communicationStyle: 'structured',
                focusForNextSession: 'Push for edge cases earlier'
            };

            const text = structuredToText(memory);
            expect(text).toContain('top strength is pattern-recognition (Identified sliding window quickly)');
            expect(text).toContain('main weakness is complexity-analysis (Forgot space complexity)');
            expect(text).toContain('communicate in a structured style');
            expect(text).toContain('Next session focus: Push for edge cases earlier');
        });
    });
});
