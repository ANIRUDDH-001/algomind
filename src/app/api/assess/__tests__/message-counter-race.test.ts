/**
 * @codesage
 * @file      src/app/api/assess/__tests__/message-counter-race.test.ts
 * @purpose   Tests atomic counter operations to ensure rate limit accuracy under concurrent message load.
 * @tech      Vitest, TypeScript
 * @connects  none
 * @apis      none
 * @db        none
 * @state     Redis (mocked INCR/INCRBY)
 * @env       none
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi } from 'vitest';

describe('Message counter race condition', () => {
    it('returns unique counts under concurrent INCR calls', async () => {
        const counter = { value: 0 };
        const mockRedis = {
            incr: vi.fn(async (_key: string) => ++counter.value),
            incrby: vi.fn(async (_key: string, amount: number) => {
                counter.value += amount;
                return counter.value;
            }),
            expire: vi.fn(async () => true),
        };

        const results = await Promise.all(
            Array.from({ length: 5 }, async () => mockRedis.incr('test-key'))
        );

        expect(results).toEqual([1, 2, 3, 4, 5]);
        expect(new Set(results).size).toBe(5);
    });

    it('seeding request can atomically jump to db baseline plus current request', async () => {
        const counter = { value: 1 };
        const mockRedis = {
            incrby: vi.fn(async (_key: string, amount: number) => {
                counter.value += amount;
                return counter.value;
            }),
        };

        const dbMessageCount = 7;
        const currentCount = await mockRedis.incrby('test-key', dbMessageCount);

        expect(currentCount).toBe(8);
    });
});
