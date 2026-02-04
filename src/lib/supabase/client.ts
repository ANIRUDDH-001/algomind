import { createBrowserClient } from '@supabase/ssr';

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

export function createClient() {
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

export function getSupabase() {
    if (!initialized) {
        supabaseInstance = createClient();
        initialized = true;
    }
    return supabaseInstance;
}
