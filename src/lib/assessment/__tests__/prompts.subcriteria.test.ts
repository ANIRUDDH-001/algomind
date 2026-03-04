import { describe, it, expect } from 'vitest';
import { generateAssessmentPrompt } from '../prompts';
import { SKILL_DEFINITIONS } from '../skill-registry';

describe('assessment prompt with sub-criteria', () => {
    const mockProblem = { title: 'Test Problem', description: 'Desc', difficulty: 'easy' };
    const mockTranscript = [{ role: 'user' as const, content: 'Hello' }];

    it('1. prompt includes sub-criterion labels for all 8 skills', () => {
        const prompt = generateAssessmentPrompt(mockProblem, mockTranscript, SKILL_DEFINITIONS);
        for (const def of Object.values(SKILL_DEFINITIONS)) {
            for (const sc of def.subCriteria) {
                expect(prompt).toContain(sc.label);
                expect(prompt).toContain(sc.id);
            }
        }
    });

    it('2. prompt instructs AI to score sub-criteria independently', () => {
        const prompt = generateAssessmentPrompt(mockProblem, mockTranscript, SKILL_DEFINITIONS);
        expect(prompt).toContain('Score each sub-criterion independently first.');
    });

    it('3. output format section includes subCriteria field', () => {
        const prompt = generateAssessmentPrompt(mockProblem, mockTranscript, SKILL_DEFINITIONS);
        expect(prompt).toContain('"subCriteria": {');
    });

    it('4. codeQuality appears in output format section', () => {
        const prompt = generateAssessmentPrompt(mockProblem, mockTranscript, SKILL_DEFINITIONS);
        expect(prompt).toContain('"codeQuality":');
        expect(prompt).toContain('correctness');
    });
});
