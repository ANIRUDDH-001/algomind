/**
 * @codesage
 * @description Tests for the transcript enricher logic ensuring final code blocks are appended correctly.
 * @section SEC-05: Core Libs: Interview & Voice
 * @author ANIRUDDH
 * @last_audited 2026-06-01
 * @skip: test-file
 */
import { describe, it, expect } from 'vitest';
import { buildEnrichedTranscript } from '../transcript-enricher';

describe('buildEnrichedTranscript', () => {
    const messages = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' }
    ];

    it('1. appends code block when code is non-empty', () => {
        const res = buildEnrichedTranscript(messages, 'print("x")', 'python', 'Test Problem');
        expect(res.length).toBe(3);
        expect(res[2].content).toContain('[FINAL CODE SUBMITTED — PYTHON]');
        expect(res[2].content).toContain('print("x")');
    });

    it('2. does NOT append code block when code is empty string', () => {
        const res = buildEnrichedTranscript(messages, '   ', 'python', 'Test Problem');
        expect(res.length).toBe(2);
    });

    it('3. includes language and line count in code block header', () => {
        const code = 'def foo():\n  pass';
        const res = buildEnrichedTranscript(messages, code, 'python', 'Test Problem');
        expect(res[2].content).toContain('Language: python');
        expect(res[2].content).toContain('Lines: 2');
    });

    it('4. preserves original conversation turns unchanged', () => {
        const res = buildEnrichedTranscript(messages, 'print()', 'python', 'Test Problem');
        expect(res[0].role).toBe('user');
        expect(res[0].content).toBe('hello');
        expect(res[1].role).toBe('assistant');
        expect(res[1].content).toBe('hi there');
    });

    it('5. code block role is "user"', () => {
        const res = buildEnrichedTranscript(messages, 'print()', 'python', 'Test Problem');
        expect(res[2].role).toBe('user');
    });

    it('6. handles multiline code correctly', () => {
        const code = 'class A:\n  def a():\n    return 1\n';
        const res = buildEnrichedTranscript(messages, code, 'python', 'Test Problem');
        expect(res[2].content).toContain('class A:');
        expect(res[2].content).toContain('Lines: 4');
    });
});
