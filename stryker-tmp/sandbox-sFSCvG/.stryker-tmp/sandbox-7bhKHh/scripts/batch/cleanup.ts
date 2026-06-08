/**
 * @codesage
 * @file      scripts/batch/cleanup.ts
 * @purpose   Runs database cleanup tasks including expiring stale submissions and removing old event rows
 * @tech      Supabase, Node.js
 * @connects  Calls Supabase RPC functions expire_stale_submissions and cleanup_old_events
 * @apis      none
 * @db        Accesses DB via RPCs
 * @state     none
 * @env       Loads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { createClient } from '@supabase/supabase-js';

export async function runCleanup(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Expire stale in_progress submissions
    const { data: expiredCount, error: expireError } = await supabase
        .rpc('expire_stale_submissions');
    if (expireError) {
        console.warn('[Cleanup] Failed to expire stale submissions:', expireError.message);
    } else {
        console.log(`[Cleanup] Expired ${expiredCount ?? 0} stale submissions`);
    }

    // Call Supabase RPC cleanup_old_events()
    // Log how many rows deleted
    const { data, error } = await supabase.rpc('cleanup_old_events');

    if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
    }

    console.log(`[cleanup] Deleted ${data || 0} old event rows.`);
}
