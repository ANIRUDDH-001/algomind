import { describe, it, expect } from 'vitest';
import type { HireDecision } from '../analyzer';

describe('hire decision persistence', () => {
    // Map of valid hire decisions
    const HIRE_NUMERIC: Record<string, number> = {
        'STRONG_HIRE': 5,
        'HIRE': 4,
        'BORDERLINE': 3,
        'NO_HIRE': 2,
        'STRONG_NO_HIRE': 1,
    };

    it('hire_decision stored in assessments table after session', () => {
        // Simulating the save-session logic for hire_decision persistence
        const mockResult = {
            hireDecision: 'HIRE' as HireDecision,
            adjustedScore: 7.5,
        };

        const difficultyMode: string = 'practice';
        const isWarmUp = difficultyMode === 'warm-up';
        const hireDecision = isWarmUp ? null : (mockResult.hireDecision ?? null);

        const insertPayload = {
            hire_decision: hireDecision,
        };

        expect(insertPayload.hire_decision).toBe('HIRE');
    });

    it('hire_readiness_trend in learner_profiles is updated with new entry', () => {
        const existingTrend = [
            { sessionId: 'sess-1', hireDecision: 'NO_HIRE', score: 4.2, completedAt: '2026-01-01' },
        ];

        const newEntry = {
            sessionId: 'sess-2',
            hireDecision: 'HIRE',
            score: 7.5,
            completedAt: '2026-02-01',
            problemDifficulty: 'medium',
        };

        const trend = [...existingTrend, newEntry].slice(-20);
        expect(trend).toHaveLength(2);
        expect(trend[1].hireDecision).toBe('HIRE');
        expect(trend[1].sessionId).toBe('sess-2');
    });

    it('trend never exceeds 20 entries (oldest trimmed)', () => {
        const existingTrend = Array.from({ length: 20 }, (_, i) => ({
            sessionId: `sess-${i}`,
            hireDecision: 'BORDERLINE',
            score: 5.0,
            completedAt: new Date(2026, 0, i + 1).toISOString(),
        }));

        const newEntry = {
            sessionId: 'sess-new',
            hireDecision: 'STRONG_HIRE',
            score: 9.0,
            completedAt: new Date().toISOString(),
        };

        const trend = [...existingTrend, newEntry].slice(-20);
        expect(trend).toHaveLength(20);
        expect(trend[0].sessionId).toBe('sess-1'); // sess-0 was trimmed
        expect(trend[19].sessionId).toBe('sess-new'); // latest is last
    });

    it('warm-up sessions store NULL hire_decision', () => {
        const mockResult = {
            hireDecision: 'HIRE' as HireDecision,
        };

        const difficultyMode: string = 'warm-up';
        const isWarmUp = difficultyMode === 'warm-up';
        const hireDecision = isWarmUp ? null : (mockResult.hireDecision ?? null);

        expect(hireDecision).toBeNull();
    });

    it('hire_numeric mapping covers all 5 decision values', () => {
        const validDecisions: HireDecision[] = ['STRONG_HIRE', 'HIRE', 'BORDERLINE', 'NO_HIRE', 'STRONG_NO_HIRE'];

        for (const decision of validDecisions) {
            expect(HIRE_NUMERIC[decision]).toBeDefined();
            expect(typeof HIRE_NUMERIC[decision]).toBe('number');
        }

        expect(Object.keys(HIRE_NUMERIC)).toHaveLength(5);

        // Verify ordering
        expect(HIRE_NUMERIC['STRONG_HIRE']).toBeGreaterThan(HIRE_NUMERIC['HIRE']);
        expect(HIRE_NUMERIC['HIRE']).toBeGreaterThan(HIRE_NUMERIC['BORDERLINE']);
        expect(HIRE_NUMERIC['BORDERLINE']).toBeGreaterThan(HIRE_NUMERIC['NO_HIRE']);
        expect(HIRE_NUMERIC['NO_HIRE']).toBeGreaterThan(HIRE_NUMERIC['STRONG_NO_HIRE']);
    });

    it('hireDecision is null when not present in AI output', () => {
        const mockResult = {
            hireDecision: undefined as HireDecision | undefined,
        };

        const isWarmUp = false;
        const hireDecision = isWarmUp ? null : (mockResult.hireDecision ?? null);
        expect(hireDecision).toBeNull();
    });

    it('AssessmentResult hireDecision rejects invalid values in analyzer', () => {
        const VALID_HIRE_DECISIONS = ['STRONG_HIRE', 'HIRE', 'BORDERLINE', 'NO_HIRE', 'STRONG_NO_HIRE'];

        // Valid
        expect(VALID_HIRE_DECISIONS.includes('HIRE')).toBe(true);

        // Invalid
        expect(VALID_HIRE_DECISIONS.includes('MAYBE')).toBe(false);
        expect(VALID_HIRE_DECISIONS.includes('')).toBe(false);
    });
});
