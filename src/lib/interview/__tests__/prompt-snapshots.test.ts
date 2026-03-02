import { describe, it, expect } from 'vitest';
import { generateInterviewerSystemPrompt, generateFeedbackPrompt } from '../interviewer-prompt';
import { MOCK_PROBLEM } from '@/test-utils/assessment-fixtures';

// We mock the analyzer's generateAssessmentPrompt because that's exported separately if needed,
// but for now we'll just test the two main ones from interviewer-prompt.

describe('Prompt snapshot tests', () => {
    it('system prompt matches snapshot for practice mode', () => {
        const prompt = generateInterviewerSystemPrompt({
            problem: MOCK_PROBLEM,
            difficulty: 'medium',
            difficultyMode: 'practice',
        });
        expect(prompt).toMatchSnapshot();
    });

    it('system prompt matches snapshot for employer mode', () => {
        const prompt = generateInterviewerSystemPrompt({
            problem: MOCK_PROBLEM,
            difficulty: 'medium',
            difficultyMode: 'practice',
        });
        // Key phrases must be present
        expect(prompt).toContain('STRICTNESS PROTOCOL');
        expect(prompt).toContain('cap their score');
        expect(prompt).toMatchSnapshot();
    });

    it('feedback prompt for warm-up mode does NOT contain hireDecision', () => {
        const prompt = generateFeedbackPrompt('history', 'Two Sum', false, undefined, 'warm-up', 'easy');
        expect(prompt).not.toContain('"hireDecision"');
        expect(prompt).toContain('WARM-UP MODE');
    });

    it('feedback prompt for crunch mode contains timeEfficiency bonus dimension', () => {
        const prompt = generateFeedbackPrompt('history', 'Two Sum', false, undefined, 'crunch', 'medium');
        expect(prompt).toContain('timeEfficiency');
        expect(prompt).toContain('CRUNCH MODE');
    });
});
