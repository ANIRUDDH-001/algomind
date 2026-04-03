import { describe, expect, it } from 'vitest';
import {
    classifyEndpoint,
    getAllEndpointPolicies,
    getFailureMode,
    isCriticalEndpoint,
} from '../decision-layer';

describe('rate-limit decision layer policy matrix', () => {
    it('enforces fail-closed for critical and service endpoints', () => {
        expect(getFailureMode('assess_start')).toBe('fail-closed');
        expect(getFailureMode('assess_complete')).toBe('fail-closed');
        expect(getFailureMode('assess_chat')).toBe('fail-closed');
        expect(getFailureMode('ai_model_selection')).toBe('fail-closed');
        expect(getFailureMode('chat')).toBe('fail-closed');
        expect(getFailureMode('voice_transcribe')).toBe('fail-closed');
    });

    it('enforces fail-open for non-critical endpoints', () => {
        expect(getFailureMode('flags')).toBe('fail-open');
        expect(getFailureMode('health')).toBe('fail-open');
        expect(getFailureMode('connectivity')).toBe('fail-open');
        expect(getFailureMode('debug')).toBe('fail-open');
    });

    it('classifies endpoint criticality', () => {
        expect(classifyEndpoint('assess_start')).toBe('critical');
        expect(classifyEndpoint('chat')).toBe('service');
        expect(classifyEndpoint('flags')).toBe('non-critical');
        expect(isCriticalEndpoint('assess_start')).toBe(true);
        expect(isCriticalEndpoint('flags')).toBe(false);
    });

    it('defaults unknown endpoints to non-critical fail-open', () => {
        expect(classifyEndpoint('unknown_endpoint')).toBe('non-critical');
        expect(getFailureMode('unknown_endpoint')).toBe('fail-open');
    });

    it('provides a non-empty endpoint policy registry', () => {
        const all = getAllEndpointPolicies();
        expect(Object.keys(all).length).toBeGreaterThan(5);
        expect(all.assess_start.failureMode).toBe('fail-closed');
    });
});
