import { getServiceClient } from '@/lib/supabase/service';

export async function checkIpRateLimit(
    ip: string,
    options: { maxRequests: number; windowSeconds: number; endpoint?: string }
): Promise<{ success: boolean; allowed?: boolean; remaining?: number }> {
    try {
        const supabase = getServiceClient();

        const identifier = options.endpoint ? `${options.endpoint}:${ip}` : ip;

        // Use the generic check_code_rate_limit DB function
        const { data } = await supabase.rpc('check_code_rate_limit', {
            p_identifier: identifier,
            p_window_seconds: options.windowSeconds,
            p_max_attempts: options.maxRequests,
        });

        const result = Array.isArray(data) ? data[0] : data;

        // The legacy checker returned `{ success: boolean, remaining?: number }`
        // Convert to exactly matched schema for compatibility
        const allowed = result?.allowed ?? true;
        return {
            success: allowed,
            allowed: allowed,
            remaining: Math.max(0, options.maxRequests - (result?.attempts_in_window ?? 0)),
        };
    } catch (error) {
        console.error('[Rate Limit] DB error:', error);
        return { success: true }; // Fail open
    }
}
