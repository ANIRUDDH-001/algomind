import { describe, expect, it } from 'vitest';
import { buildRoutingStagePlan, getEmergencyFallbackModels } from '../model-routing';

describe('routing determinism', () => {
    it('builds stable stage plan for chat when cross-tier is enabled', () => {
        const first = buildRoutingStagePlan('chat', true);
        const second = buildRoutingStagePlan('chat', true);

        expect(first).toEqual(second);
        expect(first).toEqual([
            { stage: 'primary', useCase: 'chat' },
            { stage: 'secondary', useCase: 'analysis' },
            { stage: 'emergency', useCase: 'chat' },
        ]);
    });

    it('builds stable stage plan for analysis when cross-tier is disabled', () => {
        const plan = buildRoutingStagePlan('analysis', false);

        expect(plan).toEqual([
            { stage: 'primary', useCase: 'analysis' },
            { stage: 'emergency', useCase: 'analysis' },
        ]);
    });

    it('returns deterministic emergency model ordering for a use case', () => {
        const first = getEmergencyFallbackModels('chat').map((model) => model.modelId);
        const second = getEmergencyFallbackModels('chat').map((model) => model.modelId);

        expect(first).toEqual(second);
        expect(first.length).toBeGreaterThan(0);
    });
});
