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
let _currentUrl: string | null = null;
let _currentAnonKey: string | null = null;

export function createClient(): SupabaseClient | null {
    if (!isSupabaseConfigured()) return null;
    // Strip trailing slash to ensure consistent cookie name derivation.
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createBrowserClient(url, key);
}

export function getSupabase(): SupabaseClient | null {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!_instance || _currentUrl !== url || _currentAnonKey !== anonKey) {
        _instance = createClient();
        _currentUrl = url || null;
        _currentAnonKey = anonKey || null;
    }
    return _instance;
}
