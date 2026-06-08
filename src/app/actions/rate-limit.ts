'use server';

import { checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';
import type { RateLimitResult } from '@/lib/rate-limit/types';


export async function checkRateLimitAction(userId: string): Promise<RateLimitResult | null> {
    try {
        return await checkUserRateLimit(userId);
    } catch (e) {
        console.error('[RateLimitAction] Error:', e);
        return null;
    }
}
