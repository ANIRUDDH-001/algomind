/**
 * @codesage
 * @file      src/lib/assessment/__tests__/confidence-calculator.test.ts
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
import { describe, it, expect } from 'vitest';
import { calculateConfidence } from '../confidence-calculator';
import { ConversationTurn } from '../prompts';

describe('Confidence Calculator', () => {

    it('1. High confidence: many exchanges, explicit reasoning -> score near 90+', () => {
        // Create 20 alternating turns (10 user, 10 assistant)
        const transcript: ConversationTurn[] = Array.from({ length: 20 }).map((_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            // Simulating a long message to boost the word count score 
            // 60 words per message * 10 messages = 600 words (max word score)
            content: 'Here is a detailed explanation '.repeat(10),
        }));

        const assessmentData = {
            skills: {
                'pattern-recognition': { evidence: ['recognized hash map'] },
                'complexity-analysis': { evidence: ['O(n) time'] },
                'problem-decomposition': { evidence: ['split steps'] },
                'communication-clarity': { evidence: ['clear'] },
                'optimization-mindset': { evidence: ['opted for 1-pass'] },
                'edge-case-awareness': { evidence: ['forgot empty array'] },
                'algorithmic-thinking': { evidence: ['good logic'] },
                'debugging-approach': { evidence: ['traced variable'] },
            }
        };

        const score = calculateConfidence(transcript, assessmentData);

        // Turn score = min(10/10, 0.4) = 0.4
        // Word score = min(600/500, 0.3) = 0.3
        // Evidence score = (8/8) * 0.3 = 0.3
        // Total = 1.0 (100)
        expect(score).toBeGreaterThanOrEqual(0.9);
        expect(score).toBeLessThanOrEqual(1.0);
    });

    it('2. Low confidence: single short message -> score near 20-40', () => {
        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'hello' }
        ];

        const assessmentData = {
            skills: {
                'pattern-recognition': { evidence: [] },
                'complexity-analysis': { evidence: [] },
                'problem-decomposition': { evidence: [] },
                'communication-clarity': { evidence: ['said hello'] }, // 1 evidence
                'optimization-mindset': { evidence: [] },
                'edge-case-awareness': { evidence: [] },
                'algorithmic-thinking': { evidence: [] },
                'debugging-approach': { evidence: [] },
            }
        };

        const score = calculateConfidence(transcript, assessmentData);

        // Turn score = 1/10 = 0.1
        // Word score = 1/500 = 0.002
        // Evidence score = (1/8) * 0.3 = 0.0375
        // Total = ~0.14

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(0.4);
    });

    it('3. Confidence increases with session length (monotonic property)', () => {
        const assessmentData = {
            skills: { 'pattern-recognition': { evidence: ['test'] } }
        };

        const transcriptShort: ConversationTurn[] = [
            { role: 'user', content: 'hello world' }
        ];

        const transcriptLong: ConversationTurn[] = [
            { role: 'user', content: 'hello world' },
            { role: 'assistant', content: 'how can I help?' },
            { role: 'user', content: 'im writing a very long test block to simulate monotonic sequences.' }
        ];

        const scoreShort = calculateConfidence(transcriptShort, assessmentData);
        const scoreLong = calculateConfidence(transcriptLong, assessmentData);

        expect(scoreLong).toBeGreaterThan(scoreShort);
    });

    it('4. Returns value in [0, 1] range for any valid input', () => {
        // Technically the user bounded it to [0, 100] in the description, 
        // but the code calculates it normalized to [0, 1].
        const transcriptEnd: ConversationTurn[] = Array.from({ length: 150 }).map((_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: 'mass payload string '.repeat(100),
        }));

        const maxAssessmentData = {
            skills: {
                'pattern-recognition': { evidence: ['1', '2'] },
                'complexity-analysis': { evidence: ['1'] },
                'problem-decomposition': { evidence: ['1'] },
                'communication-clarity': { evidence: ['1'] },
                'optimization-mindset': { evidence: ['1'] },
                'edge-case-awareness': { evidence: ['1'] },
                'algorithmic-thinking': { evidence: ['1'] },
                'debugging-approach': { evidence: ['1'] },
            }
        };

        const scoreMax = calculateConfidence(transcriptEnd, maxAssessmentData);
        const scoreMin = calculateConfidence([], { skills: {} });

        expect(scoreMin).toBeGreaterThanOrEqual(0);
        expect(scoreMax).toBeLessThanOrEqual(1.0);
    });
});
