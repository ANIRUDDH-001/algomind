import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateConfidence, AssessmentPartial } from '../../src/lib/assessment/confidence-calculator';
import { extractEvidence } from '../../src/lib/assessment/evidence-extractor';
import { CognitiveSkill } from '../../src/types/assessment';
import { ConversationTurn } from '../../src/lib/assessment/prompts';

describe('Assessment Fuzzing', () => {
    describe('calculateConfidence', () => {
        it('should never throw and always return a number between 0 and 1 for any inputs', () => {
            const turnArbitrary = fc.record({
                role: fc.constantFrom('user', 'assistant', 'system'),
                content: fc.string()
            }) as fc.Arbitrary<ConversationTurn>;

            const assessmentArbitrary = fc.record({
                skills: fc.dictionary(
                    fc.string(),
                    fc.record({
                        evidence: fc.array(fc.string())
                    })
                )
            }) as fc.Arbitrary<AssessmentPartial>;

            fc.assert(
                fc.property(fc.array(turnArbitrary), assessmentArbitrary, (transcript, assessment) => {
                    const result = calculateConfidence(transcript, assessment);
                    expect(typeof result).toBe('number');
                    expect(Number.isNaN(result)).toBe(false);
                    expect(result).toBeGreaterThanOrEqual(0);
                    // According to calculation, max score is 0.4 + 0.3 + 0.3 = 1.0
                    expect(result).toBeLessThanOrEqual(1.0);
                })
            );
        });

        it('should handle edge cases like very long transcripts or massive skill dictionaries', () => {
            const turnArbitrary = fc.record({
                role: fc.constantFrom('user', 'assistant', 'system'),
                content: fc.string({ maxLength: 10000 })
            }) as fc.Arbitrary<ConversationTurn>;

            const assessmentArbitrary = fc.record({
                skills: fc.dictionary(
                    fc.string(),
                    fc.record({
                        evidence: fc.array(fc.string())
                    }),
                    { maxKeys: 100 }
                )
            }) as fc.Arbitrary<AssessmentPartial>;

            fc.assert(
                fc.property(fc.array(turnArbitrary, { maxLength: 1000 }), assessmentArbitrary, (transcript, assessment) => {
                    const result = calculateConfidence(transcript, assessment);
                    expect(typeof result).toBe('number');
                    expect(Number.isNaN(result)).toBe(false);
                }),
                { numRuns: 10 } // Lower runs for large inputs
            );
        });
    });

    describe('extractEvidence', () => {
        it('should never throw and always return an array of strings', () => {
            const turnArbitrary = fc.record({
                role: fc.constantFrom('user', 'assistant', 'system'),
                content: fc.string()
            }) as fc.Arbitrary<ConversationTurn>;

            const skillArbitrary = fc.constantFrom<CognitiveSkill>(
                'problem-decomposition',
                'pattern-recognition',
                'algorithmic-thinking',
                'complexity-analysis',
                'communication-clarity',
                'edge-case-awareness',
                'optimization-mindset',
                'debugging-approach'
            );

            fc.assert(
                fc.property(fc.array(turnArbitrary), skillArbitrary, (transcript, skill) => {
                    const result = extractEvidence(transcript, skill);
                    expect(Array.isArray(result)).toBe(true);
                    expect(result.length).toBeLessThanOrEqual(3); // Based on slice(0, 3)
                    result.forEach(r => expect(typeof r).toBe('string'));
                })
            );
        });

        it('should not crash on unicode characters, empty strings, and special characters', () => {
             const turnArbitrary = fc.record({
                role: fc.constantFrom('user', 'assistant', 'system'),
                content: fc.string()
            }) as fc.Arbitrary<ConversationTurn>;

            const skillArbitrary = fc.constantFrom<CognitiveSkill>(
                'problem-decomposition',
                'pattern-recognition',
                'algorithmic-thinking',
                'complexity-analysis',
                'communication-clarity',
                'edge-case-awareness',
                'optimization-mindset',
                'debugging-approach'
            );

            fc.assert(
                fc.property(fc.array(turnArbitrary), skillArbitrary, (transcript, skill) => {
                    const result = extractEvidence(transcript, skill);
                    expect(Array.isArray(result)).toBe(true);
                })
            );
        });
    });
});
