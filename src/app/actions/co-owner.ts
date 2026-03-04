'use server';

import { createServiceRoleSupabase } from '@/lib/supabase/server';

/**
 * Check if a user has co-owner status.
 * Uses service-role client to bypass RLS (avoids 403 on co_owners table).
 */
export async function checkCoOwnerStatus(userId: string): Promise<boolean> {
    if (!userId) return false;

    try {
        const supabase = await createServiceRoleSupabase();
        const { data } = await supabase
            .from('co_owners')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        return !!data;
    } catch {
        // Non-fatal — if service role key missing, default to false
        console.warn('[co-owner] Failed to check co-owner status for user:', userId);
        return false;
    }
}
