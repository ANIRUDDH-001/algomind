// @ts-nocheck
// 
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Only instantiate Redis if the URL is provided, to prevent build errors
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = redisUrl && redisToken 
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

// Create rate limiters for different roles
// 200 requests combined per sliding window (e.g., 10 seconds or 1 minute)
// Since it's an API gateway, let's say 200 requests per 10 minutes.
export const adminRateLimit = redis
    ? new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(200, "10 m"),
          analytics: true,
          prefix: "@upstash/ratelimit/admin",
      })
    : null;

export const employerRateLimit = redis
    ? new Ratelimit({
          redis: redis,
          limiter: Ratelimit.slidingWindow(200, "10 m"),
          analytics: true,
          prefix: "@upstash/ratelimit/employer",
      })
    : null;
