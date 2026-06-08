/**
 * @codesage
 * @file      src/lib/upstash/client.ts
 * @purpose   Provides a Redis client instance with an integrated circuit breaker pattern.
 * @tech      @upstash/redis
 * @connects  Imports from @upstash/redis, exported to various caching services.
 * @apis      Upstash Redis REST API
 * @db        Redis (Upstash)
 * @state     Maintains singleton redis instance and circuit state in memory.
 * @env       UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { Redis } from '@upstash/redis';
import { logSystemEvent } from '@/lib/monitoring/events';

// Singleton instance to prevent multiple client creations
let redisInstance: Redis | null = null;
let isInitialized = false;

type CircuitStateName = 'closed' | 'open' | 'half-open';

interface CircuitState {
    state: CircuitStateName;
    consecutiveErrors: number;
    openedAt: number | null;
    lastError: string | null;
}

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 60_000;

let circuitState: CircuitState = {
    state: 'closed',
    consecutiveErrors: 0,
    openedAt: null,
    lastError: null,
};

export function getCircuitState(): Readonly<CircuitState> {
    return { ...circuitState };
}

export function isCircuitOpen(): boolean {
    if (circuitState.state !== 'open') {
        return false;
    }

    const openedAt = circuitState.openedAt ?? Date.now();
    const elapsed = Date.now() - openedAt;

    if (elapsed >= CIRCUIT_OPEN_MS) {
        circuitState.state = 'half-open';
        return false;
    }

    return true;
}

export function recordRedisAttempt(success: boolean, error?: unknown): void {
    if (success) {
        if (circuitState.state === 'half-open') {
            const previousOpenedAt = circuitState.openedAt;
            circuitState = {
                state: 'closed',
                consecutiveErrors: 0,
                openedAt: null,
                lastError: null,
            };
            console.info('[Redis] Circuit breaker CLOSED — Redis recovered');
            void logSystemEvent({
                type: 'redis_circuit_closed',
                metadata: { recoveredAfterMs: previousOpenedAt ? Date.now() - previousOpenedAt : undefined },
            });
            return;
        }

        if (circuitState.state === 'closed' && circuitState.consecutiveErrors > 0) {
            circuitState.consecutiveErrors = 0;
            circuitState.lastError = null;
        }
        return;
    }

    const message = error instanceof Error ? error.message : String(error ?? 'unknown_redis_error');
    circuitState.lastError = message;

    if (circuitState.state === 'half-open') {
        circuitState.state = 'open';
        circuitState.openedAt = Date.now();
        circuitState.consecutiveErrors = CIRCUIT_FAILURE_THRESHOLD;
        console.error('[Redis] Circuit breaker OPENED — Redis is unreachable');
        void logSystemEvent({
            type: 'redis_circuit_open',
            metadata: {
                failureCount: circuitState.consecutiveErrors,
                threshold: CIRCUIT_FAILURE_THRESHOLD,
                nextRetryAt: new Date(Date.now() + CIRCUIT_OPEN_MS).toISOString(),
            },
        });
        return;
    }

    circuitState.consecutiveErrors += 1;
    if (circuitState.state === 'closed' && circuitState.consecutiveErrors >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitState.state = 'open';
        circuitState.openedAt = Date.now();
        console.error('[Redis] Circuit breaker OPENED — Redis is unreachable');
        void logSystemEvent({
            type: 'redis_circuit_open',
            metadata: {
                failureCount: circuitState.consecutiveErrors,
                threshold: CIRCUIT_FAILURE_THRESHOLD,
                nextRetryAt: new Date(Date.now() + CIRCUIT_OPEN_MS).toISOString(),
            },
        });
    }
}

export function __resetCircuitForTests(): void {
    circuitState = {
        state: 'closed',
        consecutiveErrors: 0,
        openedAt: null,
        lastError: null,
    };
}

export function __resetRedisInstanceForTests(): void {
    redisInstance = null;
    isInitialized = false;
}

/**
 * Returns the Redis singleton instance.
 * Gracefully returns null if environment variables are not set or initialization fails.
 */
export function getRedis(): Redis | null {
    if (isCircuitOpen()) {
        return null;
    }

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
        recordRedisAttempt(true);
    } catch (error) {
        console.error('Failed to initialize Redis client:', error instanceof Error ? error.message : String(error));
        recordRedisAttempt(false, error);
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
        recordRedisAttempt(true);
        if (value === null || value === undefined) return null;

        // @upstash/redis might automatically parse JSON, so handle objects appropriately
        return typeof value === 'string'
            ? value
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);
    } catch (error) {
        recordRedisAttempt(false, error);
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
        recordRedisAttempt(true);
    } catch (error) {
        recordRedisAttempt(false, error);
        console.error(`Redis SET error [${key}]:`, error instanceof Error ? error.message : String(error));
    }
}

/**
 * Atomically increments a Redis key and optionally sets a TTL on the key.
 *
 * Uses a pipeline to execute INCR + EXPIRE in a single round-trip.
 * The EXPIRE uses the NX flag so it only sets the TTL if the key has none —
 * this preserves the original window expiry on subsequent increments.
 *
 * If the pipeline fails for any reason, returns 0 (fail-open for rate limiting).
 * The caller is responsible for deciding whether 0 means "allow" or "deny".
 */
export async function redisIncr(key: string, ttlSeconds?: number): Promise<number> {
    const redis = getRedis();
    if (!redis) return 0;

    try {
        const pipeline = redis.pipeline();
        pipeline.incr(key);

        if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
            // 'NX' means: only set TTL if the key does not already have one.
            // This prevents resetting the rate-limit window on every request.
            pipeline.expire(key, ttlSeconds, 'NX');
        }

        const results = await pipeline.exec();
        recordRedisAttempt(true);

        // results[0] is the INCR result (new count as number)
        const newCount = results?.[0];
        return typeof newCount === 'number' ? newCount : 0;

    } catch (error) {
        recordRedisAttempt(false, error);
        console.error(`[Redis] redisIncr pipeline failed [${key}]:`, error instanceof Error ? error.message : String(error));
        return 0;
    }
}

/**
 * @alias redisIncr
 * Exists to make the atomic pipeline behaviour explicit at call sites.
 */
export const redisIncrAtomic = redisIncr;

/**
 * Deletes a key from Redis.
 * Swallows errors gracefully if Redis is unavailable.
 */
export async function redisDel(key: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        await redis.del(key);
        recordRedisAttempt(true);
    } catch (error) {
        recordRedisAttempt(false, error);
        console.error(`Redis DEL error [${key}]:`, error instanceof Error ? error.message : String(error));
    }
}
