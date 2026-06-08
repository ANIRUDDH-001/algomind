// @ts-nocheck
//  -- automated unused local suppression
import { getRedis, redisGet, redisSet } from '@/lib/upstash/client';

const FREE_TIER_DAILY_TOKENS = 50_000;
const FREE_TIER_SESSION_TOKENS = 15_000;
const REDIS_PREFIX = 'cost';

export interface CostCheckResult {
  allowed: boolean;
  remaining_daily: number;
  remaining_session: number;
  reason?: 'daily_limit' | 'session_limit';
}

/**
 * Check if a user/session has budget remaining.
 * Fails open if Redis unavailable.
 */
export async function checkTokenBudget(
  userId: string,
  sessionId: string,
  estimatedTokens: number = 0
): Promise<CostCheckResult> {
  const redis = getRedis();
  if (!redis) {
    return {
      allowed: true,
      remaining_daily: FREE_TIER_DAILY_TOKENS,
      remaining_session: FREE_TIER_SESSION_TOKENS,
    };
  }

  try {
    const dailyKey = `${REDIS_PREFIX}:daily:${userId}`;
    const sessionKey = `${REDIS_PREFIX}:session:${sessionId}`;

    const [dailyUsed, sessionUsed] = await Promise.all([
      redisGet(dailyKey).then((v) => parseInt(String(v || '0'), 10)),
      redisGet(sessionKey).then((v) => parseInt(String(v || '0'), 10)),
    ]);

    const remainingDaily = FREE_TIER_DAILY_TOKENS - dailyUsed;
    const remainingSession = FREE_TIER_SESSION_TOKENS - sessionUsed;

    if (remainingDaily < estimatedTokens) {
      return {
        allowed: false,
        remaining_daily: remainingDaily,
        remaining_session: remainingSession,
        reason: 'daily_limit',
      };
    }

    if (remainingSession < estimatedTokens) {
      return {
        allowed: false,
        remaining_daily: remainingDaily,
        remaining_session: remainingSession,
        reason: 'session_limit',
      };
    }

    return {
      allowed: true,
      remaining_daily: remainingDaily,
      remaining_session: remainingSession,
    };
  } catch {
    return {
      allowed: true,
      remaining_daily: FREE_TIER_DAILY_TOKENS,
      remaining_session: FREE_TIER_SESSION_TOKENS,
    };
  }
}

/**
 * Record token usage after a successful AI call.
 * Fire-and-forget — never blocks the response.
 */
export async function recordTokenUsage(
  userId: string,
  sessionId: string,
  tokensUsed: number
): Promise<void> {
  const redis = getRedis();
  if (!redis || tokensUsed <= 0) return;

  try {
    const dailyKey = `${REDIS_PREFIX}:daily:${userId}`;
    const sessionKey = `${REDIS_PREFIX}:session:${sessionId}`;

    await Promise.all([
      redis.incrby(dailyKey, tokensUsed).then(async (val) => {
        if (val === tokensUsed) await redis.expire(dailyKey, 86400); // 24h TTL on first write
      }),
      redis.incrby(sessionKey, tokensUsed).then(async (val) => {
        if (val === tokensUsed) await redis.expire(sessionKey, 7200); // 2h session TTL
      }),
    ]);
  } catch {
    // Fail silently
  }
}

/**
 * Get current usage stats for a user (for dashboard display).
 */
export async function getUsageStats(userId: string): Promise<{
  daily_tokens_used: number;
  daily_limit: number;
  percentage: number;
}> {
  try {
    const dailyKey = `${REDIS_PREFIX}:daily:${userId}`;
    const used = parseInt(String((await redisGet(dailyKey)) || '0'), 10);
    return {
      daily_tokens_used: used,
      daily_limit: FREE_TIER_DAILY_TOKENS,
      percentage: Math.round((used / FREE_TIER_DAILY_TOKENS) * 100),
    };
  } catch {
    return { daily_tokens_used: 0, daily_limit: FREE_TIER_DAILY_TOKENS, percentage: 0 };
  }
}
