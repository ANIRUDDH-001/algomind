import { describe, expect, it } from 'vitest';
import { buildRoutingStagePlan } from '../model-routing';

describe('fallback policy matrix', () => {
    it('uses strict ordered matrix with secondary stage when cross-tier is enabled', () => {
        const stages = buildRoutingStagePlan('chat', true).map((entry) => entry.stage);
        expect(stages).toEqual(['primary', 'secondary', 'emergency']);
    });

    it('skips secondary stage when cross-tier is disabled', () => {
        const stages = buildRoutingStagePlan('chat', false).map((entry) => entry.stage);
        expect(stages).toEqual(['primary', 'emergency']);
    });

    it('routes secondary stage to alternate use case only', () => {
        const chatPlan = buildRoutingStagePlan('chat', true);
        const analysisPlan = buildRoutingStagePlan('analysis', true);

        expect(chatPlan[1]).toEqual({ stage: 'secondary', useCase: 'analysis' });
        expect(analysisPlan[1]).toEqual({ stage: 'secondary', useCase: 'chat' });
    });
});
