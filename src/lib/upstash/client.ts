import { Redis } from '@upstash/redis';

// Singleton instance to prevent multiple client creations
let redisInstance: Redis | null = null;
let isInitialized = false;

/**
 * Returns the Redis singleton instance.
 * Gracefully returns null if environment variables are not set or initialization fails.
 */
export function getRedis(): Redis | null {
    if (isInitialized) {
        return redisInstance;
    }

    isInitialized = true;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
        console.warn('UPSTASH_REDIS_REST_URL and/or UPSTASH_REDIS_REST_TOKEN are not set. Redis client disabled.');
        return null;
    }

    try {
        redisInstance = new Redis({
            url,
            token,
        });
    } catch (error) {
        console.error('Failed to initialize Redis client:', error instanceof Error ? error.message : String(error));
        redisInstance = null;
    }

    return redisInstance;
}

/**
 * Gets a string value from Redis.
 * Returns null gracefully if Redis is unavailable or on error.
 */
export async function redisGet(key: string): Promise<string | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
        const value = await redis.get<unknown>(key);
        if (value === null || value === undefined) return null;

        // @upstash/redis might automatically parse JSON, so handle objects appropriately
        return typeof value === 'string'
            ? value
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
    } catch (error) {
        console.error(`Redis GET error [${key}]:`, error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Sets a string value in Redis with an optional TTL in seconds.
 * Swallows errors gracefully if Redis is unavailable.
 */
export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
            await redis.set(key, value, { ex: ttlSeconds });
        } else {
            await redis.set(key, value);
        }
    } catch (error) {
        console.error(`Redis SET error [${key}]:`, error instanceof Error ? error.message : String(error));
    }
}

/**
 * Increments a key's value in Redis. Can also set an optional TTL.
 * Returns 0 gracefully if Redis is unavailable or on error.
 */
export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;

    try {
        const newValue = await redis.incr(key);

        // Apply TTL if provided and valid
        if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
            await redis.expire(key, ttlSeconds);
        }

        return newValue;
    } catch (error) {
        console.error(`Redis INCR error [${key}]:`, error instanceof Error ? error.message : String(error));
        return 0;
    }
}

/**
 * Deletes a key from Redis.
 * Swallows errors gracefully if Redis is unavailable.
 */
export async function redisDel(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        await redis.del(key);
    } catch (error) {
        console.error(`Redis DEL error [${key}]:`, error instanceof Error ? error.message : String(error));
    }
}
