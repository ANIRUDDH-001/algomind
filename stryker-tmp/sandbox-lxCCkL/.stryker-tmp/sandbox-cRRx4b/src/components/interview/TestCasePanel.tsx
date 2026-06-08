/**
 * @codesage
 * @file      src/components/interview/TestCasePanel.tsx
 * @purpose   Displays test cases and their execution results during code mode.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     useState, useMemo
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

//  -- automated unused local suppression
import React, { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ExecutionResult } from './CodeEditor';

export interface TestCase {
    input: string;
    expected: string;
    explanation?: string;
}

export interface TestCaseResult {
    testCase: TestCase;
    actualOutput: string;
    passed: boolean | null; // null = indeterminate (no output for this case)
}

/**
 * Normalises output strings for comparison.
 * Strips outer brackets/parens/braces and collapses whitespace.
 * Handles both "[0,1]" and "0 1" style outputs for simple cases.
 */
function normalize(s: string): string {
    return s.replace(/\s+/g, '').replace(/^[(\[{]|[)\]}]$/g, '').toLowerCase();
}

/**
 * Matches stdout lines to test cases, one line per case.
 * Exported so InterviewSession can use it without duplicating logic.
 */
export function matchResults(
    testCases: TestCase[],
    result: ExecutionResult | null
): TestCaseResult[] {
    if (!result) {
        return testCases.map(tc => ({ testCase: tc, actualOutput: '—', passed: null }));
    }
    if (result.exit_code !== 0) {
        const errorLine = result.stderr.split('\n')[0] ?? 'Runtime error';
        return testCases.map(tc => ({ testCase: tc, actualOutput: errorLine, passed: false }));
    }
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    return testCases.map((tc, i) => {
        const actual = lines[i] ?? '';
        if (!actual) return { testCase: tc, actualOutput: '(no output)', passed: null };
        const passed = normalize(actual) === normalize(tc.expected.trim());
        return { testCase: tc, actualOutput: actual, passed };
    });
}

/**
 * Builds a structured Kai context string from execution results.
 */
export function buildKaiExecutionContext(
    code: string,
    language: string,
    testCases: TestCase[],
    result: ExecutionResult,
    results: TestCaseResult[]
): string {
    const passCount = results.filter(r => r.passed === true).length;
    const total = testCases.length;
    const hasError = result.exit_code !== 0;
    const allPassed = !hasError && passCount === total;

    const statusLine = hasError
        ? `Code FAILED (exit ${result.exit_code}). Error: ${result.stderr.slice(0, 300)}`
        : allPassed
        ? `Code PASSED all ${total} test cases in ${result.runtime_ms}ms.`
        : `Code ran but only passed ${passCount}/${total} test cases in ${result.runtime_ms}ms.`;

    const caseLines = results.map((r, i) =>
        `  Case ${i + 1}: Input=${r.testCase.input} | Expected=${r.testCase.expected} | Got=${r.actualOutput} | ${
            r.passed === true ? '✅ PASS' : r.passed === false ? '❌ FAIL' : '⚠️ UNKNOWN'
        }`
    ).join('\n');

    return [
        `[Code Execution — ${language}]`,
        statusLine,
        '',
        'Test cases:',
        caseLines,
        '',
        '[Submitted Code]',
        '```' + language,
        code.slice(0, 1200),
        '```',
    ].join('\n');
}

interface TestCasePanelProps {
    testCases: TestCase[];
    executionResult: ExecutionResult | null;
    isRunning: boolean;
}

export function TestCasePanel({ testCases, executionResult, isRunning }: TestCasePanelProps) {
    const [expanded, setExpanded] = useState(true);
    const results = useMemo(() => matchResults(testCases, executionResult), [testCases, executionResult]);

    if (testCases.length === 0) return null;

    const passCount = results.filter(r => r.passed === true).length;
    const failCount = results.filter(r => r.passed === false).length;
    const total = testCases.length;

    const status = isRunning ? 'running'
        : !executionResult ? 'idle'
        : failCount === 0 ? 'pass'
        : 'fail';

    const headerBg: Record<string, string> = {
        idle:    'border-white/15 bg-[var(--surface-2)]/40',
        running: 'border-indigo-600/30 bg-indigo-950/20',
        pass:    'border-emerald-700/30 bg-emerald-950/10',
        fail:    'border-red-700/30 bg-red-950/10',
    };

    return (
        <div className={`rounded-xl border transition-all duration-300 ${headerBg[status]} overflow-hidden`}>
            {/* Header toggle */}
            <button
                data-tour="test-case-panel"
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Test Cases
                    </span>
                    {!isRunning && executionResult && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            failCount === 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                        }`}>
                            {passCount}/{total} passed
                        </span>
                    )}
                    {isRunning && (
                        <span className="text-[10px] font-bold text-indigo-400 animate-pulse">Running…</span>
                    )}
                </div>
                {expanded
                    ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                    : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
            </button>

            {/* Cases */}
            {expanded && (
                <div className="border-t border-white/10/30 divide-y divide-slate-700/20">
                    {results.map((r, i) => (
                        <div key={i} className="px-3 py-2.5">
                            <div className="flex items-start gap-2.5">
                                {/* Status icon */}
                                <div className="mt-0.5 shrink-0">
                                    {isRunning
                                        ? <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                                        : r.passed === true
                                        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        : r.passed === false
                                        ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                                        : <AlertCircle className="w-3.5 h-3.5 text-zinc-600" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-zinc-500 mb-1.5">
                                        Case {i + 1}
                                        {r.testCase.explanation && (
                                            <span className="font-normal text-zinc-700 ml-1.5">
                                                — {r.testCase.explanation}
                                            </span>
                                        )}
                                    </p>
                                    {/* Input / Expected / Output grid */}
                                    <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                                        {[
                                            { label: 'Input', value: r.testCase.input, color: 'text-zinc-300' },
                                            { label: 'Expected', value: r.testCase.expected, color: 'text-emerald-300' },
                                            {
                                                label: 'Your output',
                                                value: isRunning ? '…' : executionResult ? r.actualOutput : '—',
                                                color: !executionResult || isRunning
                                                    ? 'text-zinc-600'
                                                    : r.passed === true ? 'text-emerald-300'
                                                    : r.passed === false ? 'text-red-300'
                                                    : 'text-zinc-400',
                                            },
                                        ].map(col => (
                                            <div
                                                key={col.label}
                                                className="rounded-lg px-2 py-1.5 bg-black/20 border border-white/5"
                                            >
                                                <p className="text-zinc-700 mb-0.5 text-[9px] uppercase tracking-wider">{col.label}</p>
                                                <p className={`break-all leading-relaxed ${col.color}`}>{col.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
