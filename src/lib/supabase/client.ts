import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

// ── Config check ─────────────────────────────────────────────────────────────

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

// ── Client singleton ─────────────────────────────────────────────────────────

let _instance: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
    if (!isSupabaseConfigured()) return null;
    // NEXT_PUBLIC_SUPABASE_URL is the Cloudflare Worker URL in production.
    // This bypasses Indian ISP DNS blocks on *.supabase.co.
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
}

export function getSupabase(): SupabaseClient | null {
    if (!_instance) {
        _instance = createClient();
    }
    return _instance;
}

// ── Removed: probeAndAutoProxy, isProxyMode, enableProxyMode, disableProxyMode
// These are no longer needed — CF Worker is always-on and always reachable.
