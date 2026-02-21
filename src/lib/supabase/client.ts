import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

// Check if Supabase is properly configured
export function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    return !!(
        url &&
        key &&
        url.startsWith('https://') &&
        !url.includes('your_') &&
        !key.includes('your_')
    );
}

export function createClient(): SupabaseClient | null {
    if (!isSupabaseConfigured()) {
        return null;
    }

    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Export a singleton for client components
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;
let initialized = false;

export function getSupabase(): SupabaseClient | null {
    if (!initialized) {
        supabaseInstance = createClient();
        initialized = true;
    }
    return supabaseInstance;
}
