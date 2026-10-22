/**
 * @codesage
 * @file      src/lib/ai/__tests__/reasoning.test.ts
 * @purpose   Tests for central reasoning-tag stripping, JSON extraction and Groq reasoning params.
 * @tech      Vitest
 * @connects  ../reasoning
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { describe, it, expect } from 'vitest';
import { stripReasoning, extractJsonObject, groqReasoningParams } from '../reasoning';

describe('stripReasoning', () => {
    it('removes closed think/thinking/reasoning blocks', () => {
        expect(stripReasoning('<think>hmm</think>Answer')).toBe('Answer');
        expect(stripReasoning('<thinking a="1">x</thinking> A <reasoning>y</reasoning>B')).toBe('A B');
    });
    it('removes an unclosed think block cut off by max_tokens', () => {
        expect(stripReasoning('{"a":1}<think>He wants JSON so I')).toBe('{"a":1}');
        expect(stripReasoning('<think>He wants JSON so I')).toBe('');
    });
    it('removes an orphan closing tag and everything before it', () => {
        expect(stripReasoning('partial thought</think>{"a":1}')).toBe('{"a":1}');
    });
    it('leaves normal text alone', () => {
        expect(stripReasoning('Use a hash map; O(n) time.')).toBe('Use a hash map; O(n) time.');
    });
});

describe('extractJsonObject', () => {
    it('parses JSON wrapped in think tags and code fences', () => {
        expect(extractJsonObject<{ a: number }>('<think>He</think>```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    });
    it('parses JSON with leading prose', () => {
        expect(extractJsonObject<{ ok: boolean }>('Here you go: {"ok": true} thanks')).toEqual({ ok: true });
    });
    it('throws SyntaxError when there is no object (the memory-generator crash input)', () => {
        expect(() => extractJsonObject('<think>He wants a JSON object')).toThrow(SyntaxError);
    });
});

describe('groqReasoningParams', () => {
    it('gpt-oss: low effort, reasoning excluded', () => {
        expect(groqReasoningParams('openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low', include_reasoning: false });
    });
    it('qwen: hidden format, no reasoning effort', () => {
        expect(groqReasoningParams('qwen/qwen3.8-27b')).toEqual({ reasoning_format: 'hidden', reasoning_effort: 'none' });
    });
    it('other models: no extra params', () => {
        expect(groqReasoningParams('llama-3.3-70b-versatile')).toEqual({});
    });
});
