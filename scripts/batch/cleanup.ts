import { createClient } from '@supabase/supabase-js';

export async function runCleanup(): Promise<void> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call Supabase RPC cleanup_old_events()
    // Log how many rows deleted
    const { data, error } = await supabase.rpc('cleanup_old_events');

    if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
    }

    console.log(`[cleanup] Deleted ${data || 0} old event rows.`);
}
