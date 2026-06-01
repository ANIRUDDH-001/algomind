/**
 * @codesage
 * @file      src/hooks/__tests__/useAssessment.test.ts
 * @purpose   Unit tests for the useAssessment React hook.
 * @tech      Vitest, React Testing Library
 * @connects  Tests useAssessment
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/assessment/analyzer', () => ({
    CognitiveAnalyzer: vi.fn().mockImplementation(() => ({
        analyze: vi.fn().mockResolvedValue({ overall: 80, skills: {} }),
    })),
}));

import { useAssessment } from '../useAssessment';

describe('useAssessment — smoke', () => {
    it('does not throw on mount', () => {
        expect(() => renderHook(() => useAssessment())).not.toThrow();
    });

    it('returns correct default shape', () => {
        const { result } = renderHook(() => useAssessment());
        expect(result.current.isAnalyzing).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.result).toBeNull();
        expect(typeof result.current.analyzeSession).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });
});
