/**
 * @codesage
 * @file      src/lib/monitoring/__tests__/voice-events-sampling.test.ts
 * @purpose   Voice telemetry must never be sampled away (production samples INFO at 10%).
 * @tech      Vitest
 * @connects  ../events (logSystemEventStrict, sampling)
 * @apis      none
 * @db        system_events (service client mocked)
 * @state     none
 * @env       NODE_ENV=production (stubbed)
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const insert = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock('@/lib/supabase/service', () => ({ getServiceClient: () => ({ from: () => ({ insert }) }) }));

import { logSystemEventStrict, EventTypes, type SystemEventType } from '../events';

const send = (type: SystemEventType, i: number) => logSystemEventStrict({
    type, event_version: 'v1', severity: EventTypes[type].severity, occurred_at: new Date().toISOString(),
    correlation_id: `corr-${i}`, source: 'http',
    metadata: { component: 'voice', operation: 'turn', environment: 'production' },
});

describe('voice telemetry sampling', () => {
    beforeEach(() => {
        insert.mockClear();
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('OBS_SAMPLE_RATE', '');
        vi.stubEnv('BETTERSTACK_SOURCE_TOKEN', '');
    });
    afterEach(() => vi.unstubAllEnvs());

    it('ordinary INFO events are sampled in production (control)', async () => {
        for (let i = 0; i < 20; i++) await send('ai.llm_request', i);
        expect(insert.mock.calls.length).toBeLessThan(20);
    });

    it.each(['voice.turn_timeline', 'voice.engine_error', 'voice.mic_status'] as SystemEventType[])('%s is always persisted', async (type) => {
        for (let i = 0; i < 20; i++) await send(type, i);
        expect(insert).toHaveBeenCalledTimes(20);
    });
});
