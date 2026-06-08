/**
 * @codesage
 * @file      src/app/api/admin/cost-stats/route.ts
 * @purpose   Fetches daily token usage cost statistics per user from Redis.
 * @tech      Next.js, Redis, TypeScript
 * @connects  @/lib/auth/requireAdminForApi, @/lib/upstash/client
 * @apis      none
 * @db        Redis (cost:daily:*)
 * @state     none
 * @env       none
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextResponse } from 'next/server';
import { requireAdminForApi } from '@/lib/auth/requireAdminForApi';
import { getRedis } from '@/lib/upstash/client';

export async function GET() {
  const { errorResponse } = await requireAdminForApi();
  if (errorResponse) return errorResponse;

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Redis not available' }, { status: 503 });
  }

  try {
    // Scan for all daily cost keys
    const keys: string[] = [];
    let cursor = 0;
    do {
      const [newCursor, found] = await redis.scan(cursor, { match: 'cost:daily:*', count: 100 });
      cursor = typeof newCursor === 'number' ? newCursor : parseInt(String(newCursor), 10);
      keys.push(...(found as string[]));
    } while (cursor !== 0);

    // Get values for all keys
    let totalTokensToday = 0;
    const userBreakdown: { userId: string; tokens: number }[] = [];

    if (keys.length > 0) {
      const values = await redis.mget(...keys);
      keys.forEach((key, i) => {
        const tokens = parseInt(String(values[i] || '0'), 10);
        const userId = key.replace('cost:daily:', '');
        totalTokensToday += tokens;
        userBreakdown.push({ userId, tokens });
      });
    }

    // Sort by usage descending
    userBreakdown.sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      total_tokens_today: totalTokensToday,
      active_users: keys.length,
      top_users: userBreakdown.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cost stats' }, { status: 500 });
  }
}
