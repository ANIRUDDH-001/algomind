/**
 * @codesage
 * @file      src/lib/voice/__tests__/sentence-streamer.test.ts
 * @purpose   SentenceStreamer — streamed LLM deltas → speakable sentences (no code, no control tokens).
 * @tech      Vitest
 * @connects  ../sentence-streamer
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect } from 'vitest';
import { SentenceStreamer } from '../sentence-streamer';

const run = (deltas: string[]) => {
    const s = new SentenceStreamer(); const out: string[] = [];
    for (const d of deltas) out.push(...s.push(d));
    out.push(...s.flush());
    return out;
};

describe('SentenceStreamer', () => {
    it('emits a sentence as soon as it is complete', () => {
        const s = new SentenceStreamer();
        expect(s.push('Great, let us start with the ')).toEqual([]);
        expect(s.push('constraints. What is')).toEqual(['Great, let us start with the constraints.']);
        expect(s.flush()).toEqual(['What is']);
    });
    it('does not split decimals, O(n log n), or abbreviations', () => {
        expect(run(['It runs in O(n log n) time, e.g. merge sort. That is 1.5x faster.']))
            .toEqual(['It runs in O(n log n) time, e.g. merge sort.', 'That is 1.5x faster.']);
    });
    it('merges very short fragments with the next sentence', () => {
        expect(run(['Okay. Walk me through your approach.'])).toEqual(['Okay. Walk me through your approach.']);
    });
    it('holds a short fragment while streaming instead of speaking it alone', () => {
        const s = new SentenceStreamer();
        expect(s.push('Okay. ')).toEqual([]);
        expect(s.push('Walk me through your approach. ')).toEqual(['Okay. Walk me through your approach.']);
    });
    it('never speaks code blocks', () => {
        expect(run(['Try this:\n```python\ndef f(x):\n  return x\n```\nWhat is its complexity?']))
            .toEqual(['Try this:', 'What is its complexity?']);
    });
    it('never speaks a code block split across deltas', () => {
        expect(run(['Look at this ``', '`js\nconst a = 1;\n`', '``\nDoes that help?']))
            .toEqual(['Look at this', 'Does that help?']);
    });
    it('strips TERMINATE_INTERVIEW even when split across deltas', () => {
        expect(run(['Thanks for your time today. TERMINATE_', 'INTERVIEW'])).toEqual(['Thanks for your time today.']);
    });
    it('treats newlines as boundaries and skips empty lines', () => {
        expect(run(['First point is here.\n\nSecond point is here.'])).toEqual(['First point is here.', 'Second point is here.']);
    });
    it('cuts run-on text longer than 220 chars at a comma', () => {
        const out = run([`${'word '.repeat(30)}, ${'more '.repeat(30)}`]);
        expect(out.every(s => s.length <= 220)).toBe(true);
        expect(out.length).toBeGreaterThan(1);
    });
});
