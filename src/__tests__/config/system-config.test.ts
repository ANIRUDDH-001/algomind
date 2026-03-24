import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getSystemConfig,
    getWeeklySessionLimit,
    isSessionGatingEnabled,
} from '@/lib/config/system-config';
import { SYSTEM_CONFIG_DEFAULTS, SYSTEM_CONFIG_KEYS } from '@/lib/config/system-config-keys';
import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';

vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

vi.mock('@/lib/upstash/client', () => ({
    getRedis: vi.fn(),
}));

describe('SystemConfig', () => {
    const mockRedisGet = vi.fn();
    const mockRedisSet = vi.fn();
    const mockSingle = vi.fn();
    const mockEq = vi.fn();
    const mockSelect = vi.fn();
    const mockFrom = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        mockRedisGet.mockResolvedValue(null);
        mockRedisSet.mockResolvedValue('OK');
        vi.mocked(getRedis).mockReturnValue({
            get: mockRedisGet,
            set: mockRedisSet,
        } as any);

        mockSingle.mockResolvedValue({
            data: { value: 'true' },
            error: null,
        });
        mockEq.mockReturnValue({ single: mockSingle });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        vi.mocked(getServiceClient).mockReturnValue({
            from: mockFrom,
        } as any);
    });

    describe('getSystemConfig', () => {
        it('returns DB value when available', async () => {
            mockSingle.mockResolvedValueOnce({ data: { value: '10' }, error: null });

            const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT);

            expect(value).toBe('10');
            expect(getServiceClient).toHaveBeenCalledTimes(1);
        });

        it('returns default when DB fails', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: new Error('db down') });

            const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT);

            expect(value).toBe(SYSTEM_CONFIG_DEFAULTS[SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT]);
        });

        it('caches value in Redis', async () => {
            mockSingle.mockResolvedValueOnce({ data: { value: '7' }, error: null });

            await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT);

            expect(mockRedisSet).toHaveBeenCalledWith(
                'system_config:free_tier_weekly_session_limit',
                '7',
                { ex: 300 }
            );
        });

        it('serves from Redis cache on second call', async () => {
            mockRedisGet.mockResolvedValueOnce('11');

            const value = await getSystemConfig(SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT);

            expect(value).toBe('11');
            expect(getServiceClient).not.toHaveBeenCalled();
        });
    });

    describe('getWeeklySessionLimit', () => {
        it('returns 5 by default', async () => {
            mockSingle.mockResolvedValueOnce({ data: null, error: new Error('db fail') });

            expect(await getWeeklySessionLimit()).toBe(5);
        });

        it('parses numeric string correctly', async () => {
            mockSingle.mockResolvedValueOnce({ data: { value: '10' }, error: null });

            expect(await getWeeklySessionLimit()).toBe(10);
        });
    });

    describe('isSessionGatingEnabled', () => {
        it('returns true when value is "true"', async () => {
            mockSingle.mockResolvedValueOnce({ data: { value: 'true' }, error: null });

            expect(await isSessionGatingEnabled()).toBe(true);
        });

        it('returns false when value is "false"', async () => {
            mockSingle.mockResolvedValueOnce({ data: { value: 'false' }, error: null });

            expect(await isSessionGatingEnabled()).toBe(false);
        });
    });
});
