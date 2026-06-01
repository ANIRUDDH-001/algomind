/**
 * @codesage
 * @file      src/components/interview/__tests__/TestCasePanel.test.tsx
 * @purpose   Tests for TestCasePanel and execution context generation.
 * @tech      Vitest
 * @connects  ../TestCasePanel
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
import { describe, it, expect } from 'vitest';
import { matchResults, buildKaiExecutionContext } from '../TestCasePanel';
import type { TestCase } from '../TestCasePanel';

const cases: TestCase[] = [
    { input: '[2,7,11,15], 9', expected: '[0,1]' },
    { input: '[3,2,4], 6', expected: '[1,2]' },
];

const makeResult = (stdout: string, exit_code = 0, stderr = '') => ({
    stdout, stderr, exit_code, runtime_ms: 50, language: 'python',
});

describe('matchResults', () => {
    it('marks both cases pass when stdout lines match', () => {
        const r = matchResults(cases, makeResult('[0,1]\n[1,2]\n'));
        expect(r[0].passed).toBe(true);
        expect(r[1].passed).toBe(true);
    });
    it('marks fail when output is wrong', () => {
        const r = matchResults(cases, makeResult('[0,2]\n[0,1]\n'));
        expect(r[0].passed).toBe(false);
        expect(r[1].passed).toBe(false);
    });
    it('all fail when exit_code !== 0', () => {
        const r = matchResults(cases, makeResult('', 1, 'SyntaxError'));
        r.forEach(x => expect(x.passed).toBe(false));
    });
    it('marks null when no stdout for that case', () => {
        const r = matchResults(cases, makeResult('[0,1]\n'));
        expect(r[0].passed).toBe(true);
        expect(r[1].passed).toBeNull();
    });
    it('returns null for all when result is null', () => {
        const r = matchResults(cases, null);
        r.forEach(x => expect(x.passed).toBeNull());
    });
});

describe('buildKaiExecutionContext', () => {
    it('includes PASS marker in output', () => {
        const result = makeResult('[0,1]\n[1,2]\n');
        const testResults = matchResults(cases, result);
        const ctx = buildKaiExecutionContext('print()', 'python', cases, result, testResults);
        expect(ctx).toContain('✅ PASS');
        expect(ctx).toContain('PASSED all 2 test cases');
    });
    it('includes FAIL marker when output wrong', () => {
        const result = makeResult('[0,2]\n[0,1]\n');
        const testResults = matchResults(cases, result);
        const ctx = buildKaiExecutionContext('print()', 'python', cases, result, testResults);
        expect(ctx).toContain('❌ FAIL');
    });
});
