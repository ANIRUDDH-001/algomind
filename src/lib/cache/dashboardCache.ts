import { getRedis } from '@/lib/upstash/client';

const CACHE_TTL = 300; // 5 minutes

export type DashboardAverages = Record<string, number>;

export async function getCachedDashboardAverages(userId: string): Promise<DashboardAverages | null> {
    const redis = getRedis();
    if (!redis) return null;

    const cacheKey = `dashboard:averages:${userId}`;

    try {
        const cached = await redis.get<DashboardAverages>(cacheKey);
        if (cached) return cached;
    } catch (error) {
        console.error('Redis GET error for dashboard averages:', error);
    }

    return null;
}

export async function setCachedDashboardAverages(userId: string, data: DashboardAverages): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const cacheKey = `dashboard:averages:${userId}`;
    try {
        // Upstash automatically serializes objects to JSON
        await redis.setex(cacheKey, CACHE_TTL, data);
    } catch (error) {
        console.error('Redis SET error for dashboard averages:', error);
    }
}

export async function invalidateDashboardCache(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        await redis.del(`dashboard:averages:${userId}`);
    } catch (error) {
        console.error('Redis DEL error for dashboard averages:', error);
    }
}
