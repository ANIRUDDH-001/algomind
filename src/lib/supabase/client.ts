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

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // 🛡️ MOBILE/DNS BYPASS
    // If the user has manually enabled proxy (or if auto-detection flipped it)
    // Use our Next.js edge route instead of direct Supabase URL
    if (typeof window !== 'undefined') {
        const useProxy = sessionStorage.getItem('use_supabase_proxy') === 'true';
        if (useProxy) {
            // Point to our local proxy route
            supabaseUrl = window.location.origin + '/supabase-proxy';
            console.warn('🛡️ [Supabase Client] Using Edge Proxy for DNS Bypass');
        }
    }

    return createBrowserClient(supabaseUrl, supabaseKey);
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
