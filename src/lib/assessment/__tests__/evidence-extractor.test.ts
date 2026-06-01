/**
 * @codesage
 * @file      src/lib/assessment/__tests__/evidence-extractor.test.ts
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
import { extractEvidence } from '../evidence-extractor';
import { ConversationTurn } from '../prompts';

describe('Evidence Extractor', () => {

    it('1. Extracts code snippets from messages correctly', () => {
        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'Here is my `const x = 1` logic' },
            { role: 'user', content: 'Here is another thought process' }
        ];

        // Should pull the block with the `code` inside algorithms logic
        const evidence = extractEvidence(transcript, 'algorithmic-thinking');
        expect(evidence.length).toBeGreaterThan(0);
        expect(evidence[0]).toContain('`const x = 1`');
    });

    it('2. Extracts complexity mentions (O(n), O(log n)) from text', () => {
        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'This runs in O(n) time' },
            { role: 'user', content: 'This utilizes O(log n) space' },
            { role: 'user', content: 'Just an empty sentence.' }
        ];

        const evidence = extractEvidence(transcript, 'complexity-analysis');
        expect(evidence).toHaveLength(2); // Top 2 matched constraints
        expect(evidence[0]).toContain('O(n)');
        expect(evidence[1]).toContain('O(log n)');
    });

    it('3. Extracts edge case mentions ("null", "empty", "overflow")', () => {
        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'What if the array is empty?' },
            { role: 'user', content: 'We need to check for integer overflow.' },
            { role: 'assistant', content: 'You missed checking if it is null.' }
        ];

        const evidence = extractEvidence(transcript, 'edge-case-awareness');
        expect(evidence).toHaveLength(3);
        expect(evidence[0]).toContain('array is empty');
        expect(evidence[1]).toContain('integer overflow');
        expect(evidence[2]).toContain('null');
    });

    it('4. Empty transcript -> returns empty evidence object', () => {
        const transcript: ConversationTurn[] = [];

        const evidence = extractEvidence(transcript, 'debugging-approach');
        expect(evidence).toEqual([]);
    });

    it('5. Evidence from both user and assistant messages included', () => {
        const transcript: ConversationTurn[] = [
            { role: 'user', content: 'I should break down the problem into subproblems.' },
            { role: 'assistant', content: 'That is a good first step to divide it.' }
        ];

        const evidence = extractEvidence(transcript, 'problem-decomposition');
        expect(evidence).toHaveLength(2);

        // Assert Assistant mapping works
        expect(evidence[1]).toContain('divide');
    });
});
