import { generateSession1Baseline } from '../narrative-generator';
import { UnifiedAIClient } from '../client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => {
    return {
        UnifiedAIClient: vi.fn()
    };
});

describe('generateSession1Baseline', () => {
    let mockGenerateCompletion: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockGenerateCompletion = vi.fn().mockResolvedValue({
            success: true,
            response: 'This student demonstrated a strong grasp of algorithmic thinking, specifically utilizing a sliding window approach efficiently. However, they struggled with optimizing their space complexity. Focus for the next session should be on memory constraints and array-in-place operations.'
        });

        vi.mocked(UnifiedAIClient).mockImplementation(function () {
            return {
                generateCompletion: mockGenerateCompletion
            } as any;
        } as any);
    });

    const mockSession = {
        sessionId: 'test_session_id',
        problemTitle: 'Minimum Window Substring',
        problemDifficulty: 'hard' as const,
        overallScore: 6.5,
        completedAt: new Date().toISOString(),
        skills: {
            'algorithmic-thinking': 8,
            'pattern-recognition': 7,
            'complexity-analysis': 3,
            'communication-clarity': 4
        }
    };

    it('generates a successful baseline narrative via AI', async () => {
        const result = await generateSession1Baseline({
            userId: 'user_123',
            session: mockSession
        });

        expect(result).toContain('This student demonstrated a strong grasp');
        expect(mockGenerateCompletion).toHaveBeenCalled();

        // Check if the prompt properly identified strengths and weaknesses
        const promptSent = mockGenerateCompletion.mock.calls[0][0][0].content;
        expect(promptSent).toContain('Problem: Minimum Window Substring');
        expect(promptSent).toContain('Overall Score: 6.5');
        expect(promptSent).toContain('Strongest skills: Algorithmic Thinking, Pattern Recognition');
        expect(promptSent).toContain('Weakest skills: Complexity Analysis, Communication Clarity');
    });

    it('returns null on AI error', async () => {
        mockGenerateCompletion.mockResolvedValueOnce({
            success: false,
            error: 'Network timeout'
        });

        const result = await generateSession1Baseline({
            userId: 'user_123',
            session: mockSession
        });

        expect(result).toBeNull();
    });

    it('returns null if unexpected exception occurs', async () => {
        mockGenerateCompletion.mockRejectedValueOnce(new Error('Syntax Error'));

        const result = await generateSession1Baseline({
            userId: 'user_123',
            session: mockSession
        });

        expect(result).toBeNull();
    });
});
