import { Redis } from '@upstash/redis';

export async function checkIpRateLimit(ip: string, options: { maxRequests: number; windowSeconds: number }) {
    if (ip === 'unknown') return { success: true };

    try {
        const redis = Redis.fromEnv();
        const key = `rate:ip:${ip}`;

        const current = await redis.incr(key);
        if (current === 1) {
            await redis.expire(key, options.windowSeconds);
        }

        if (current > options.maxRequests) {
            return { success: false };
        }

        return { success: true, remaining: options.maxRequests - current };
    } catch (error) {
        console.error('[Rate Limit] Redis error:', error);
        return { success: true }; // Fail open
    }
}
