import { describe, expect, it } from 'vitest';
import { parseGeminiResultText } from '../../../supabase/functions/run-assessment/analysis-parser';

describe('run-assessment parser contract', () => {
    it('parses valid structured output', () => {
        const input = JSON.stringify({
            overallScore: 8,
            overallFeedback: 'Good analysis and communication.',
            nextSteps: ['Practice edge cases', 'Improve complexity explanations'],
            skills: {
                'algorithmic-thinking': { score: 8, evidence: 'Solid approach.' },
            },
        });

        const parsed = parseGeminiResultText(input);
        expect(parsed.overallScore).toBe(8);
        expect(parsed.skills['algorithmic-thinking'].score).toBe(8);
    });

    it('throws parse_failed on invalid JSON', () => {
        expect(() => parseGeminiResultText('{invalid')).toThrow('parse_failed: invalid_json');
    });

    it('throws schema_invalid when mandatory fields are missing', () => {
        const input = JSON.stringify({ overallScore: 8, nextSteps: [], skills: {} });
        expect(() => parseGeminiResultText(input)).toThrow('schema_invalid: overallFeedback required');
    });
});
