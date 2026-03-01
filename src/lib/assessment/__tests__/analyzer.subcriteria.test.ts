import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CognitiveAnalyzer } from '../analyzer';

const mockGenerate = vi.fn();
vi.mock('@/lib/ai/client', () => ({
    getAIClient: () => ({
        generateCompletion: mockGenerate
    })
}));
vi.mock('../score-validator', () => ({
    validateAndCorrectScores: vi.fn().mockResolvedValue({ correctedScores: {}, inflationDetected: false, validationNotes: '' }),
    applyValidation: vi.fn().mockImplementation(s => s)
}));

describe('CognitiveAnalyzer with sub-criteria', () => {
    let analyzer: CognitiveAnalyzer;

    beforeEach(() => {
        mockGenerate.mockClear();
        analyzer = new CognitiveAnalyzer();
        (analyzer as any).maxRetries = 1;
        (analyzer as any).retryDelayMs = 0;
    });

    it('1. computeWeightedScore matches manual calculation within 0.1', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({
                skills: {
                    'problem-decomposition': {
                        score: 4, // Intentionally wrong
                        subCriteria: {
                            clarifiesAmbiguity: 10,
                            identifiesSubproblems: 10,
                            definesInterfaces: 10,
                            handlesDependencies: 10
                        },
                        evidence: [], strengths: [], improvements: []
                    }
                },
                overallFeedback: 'Good',
                nextSteps: []
            })
        });

        const res = await analyzer.analyze('s1', { title: 'P', description: 'D', difficulty: 'easy' }, []);
        expect(res.skills['problem-decomposition'].score).toBe(10);
    });

    it('2. stores sub_criteria JSONB in returned AssessmentResult', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({
                skills: {
                    'problem-decomposition': {
                        score: 10,
                        subCriteria: { clarifiesAmbiguity: 8 },
                        evidence: [], strengths: [], improvements: []
                    }
                },
                overallFeedback: 'Good', nextSteps: []
            })
        });

        const res = await analyzer.analyze('s1', { title: 'P', description: 'D', difficulty: 'easy' }, []);
        expect(res.skills['problem-decomposition'].subCriteria.clarifiesAmbiguity).toBe(8);
    });

    it('3. corrects dimension score when it deviates > 0.5 from sub-criteria average', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({
                skills: {
                    'problem-decomposition': {
                        score: 2, // Way off
                        subCriteria: { clarifiesAmbiguity: 10, identifiesSubproblems: 10, definesInterfaces: 10, handlesDependencies: 10 },
                        evidence: [], strengths: [], improvements: []
                    }
                },
                overallFeedback: 'Good', nextSteps: []
            })
        });
        const res = await analyzer.analyze('s1', { title: 'P', description: 'D', difficulty: 'easy' }, []);
        expect(res.skills['problem-decomposition'].score).toBe(10);
    });

    it('4. handles missing sub-criteria gracefully (defaults to 5)', async () => {
        mockGenerate.mockResolvedValueOnce({
            success: true,
            response: JSON.stringify({
                skills: {
                    'problem-decomposition': {
                        score: 8,
                        // No subCriteria
                        evidence: [], strengths: [], improvements: []
                    }
                },
                overallFeedback: 'Good', nextSteps: []
            })
        });
        const res = await analyzer.analyze('s1', { title: 'P', description: 'D', difficulty: 'easy' }, []);
        // should default to what was given or 5
        expect(res.skills['problem-decomposition'].score).toBe(8);
        expect(res.skills['problem-decomposition'].subCriteria).toEqual({});
    });
});
