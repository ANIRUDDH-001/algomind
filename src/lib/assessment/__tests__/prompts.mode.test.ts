import { describe, it, expect } from 'vitest';
import { generateAssessmentPrompt } from '../prompts';
import { SKILL_DEFINITIONS } from '../skill-registry';

describe('generateAssessmentPrompt with Mode', () => {
    const mockProblem = { title: 'Test', description: 'Desc', difficulty: 'hard', difficultyMode: 'employer' as any };
    const mockTranscript = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }] as any[];

    it('includes difficulty calibration for hard problems', () => {
        const prompt = generateAssessmentPrompt(mockProblem, mockTranscript, SKILL_DEFINITIONS);
        expect(prompt).toContain('Problem difficulty is HARD.');
        expect(prompt).toContain('EMPLOYER ASSESSMENT'); // from MODE_ASSESSMENT_CONFIGS
        expect(prompt).toContain('hireDecision'); // checking for hire decision in output instructions
    });
});
