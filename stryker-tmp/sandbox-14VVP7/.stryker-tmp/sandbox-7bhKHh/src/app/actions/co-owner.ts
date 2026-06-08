/**
 * @codesage
 * @file      src/app/actions/co-owner.ts
 * @purpose   Server action to check co-owner status bypassing RLS
 * @tech      Next.js Server Actions, Supabase
 * @connects  @/lib/supabase/server
 * @apis      None
 * @db        co_owners
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use server';

import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { err, ok, type Result } from '@/lib/api/result';

/**
 * Check if a user has co-owner status.
 * Uses service-role client to bypass RLS (avoids 403 on co_owners table).
 */
export async function checkCoOwnerStatus(userId: string): Promise<Result<{ isCoOwner: boolean }>> {
    if (!userId) return ok({ isCoOwner: false });

    try {
        const supabase = await createServiceRoleSupabase();
        const { data } = await supabase
            .from('co_owners')
            .select('id')
            .eq('user_id', userId)
            .limit(1)
            .maybeSingle();

        return ok({ isCoOwner: !!data });
    } catch {
        // Non-fatal — if service role key missing, default to false
        console.warn('[co-owner] Failed to check co-owner status for user:', userId);
        return err('Failed to check co-owner status', 'co_owner_check_failed');
    }
}
