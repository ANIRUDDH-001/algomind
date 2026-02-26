import { createBrowserClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';

// Export a singleton for client components
let supabaseInstance: SupabaseClient | null = null;
let initialized = false;

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

export function isProxyMode(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('use_supabase_proxy') === 'true';
}

export function enableProxyMode(): void {
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('use_supabase_proxy', 'true');
        window.dispatchEvent(new CustomEvent('supabase-proxy-enabled'));
    }
    supabaseInstance = null;
    initialized = false;
}

export function disableProxyMode(): void {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('use_supabase_proxy');
        sessionStorage.removeItem('supabase_probe_result');
    }
    supabaseInstance = null;
    initialized = false;
}

export async function probeAndAutoProxy(): Promise<'proxy' | 'direct' | null> {
    if (typeof window === 'undefined') return null;
    if (isProxyMode()) return 'proxy';

    const cached = sessionStorage.getItem('supabase_probe_result');
    if (cached === 'proxy' || cached === 'direct') {
        return cached as 'proxy' | 'direct';
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await fetch(`${url}/auth/v1/health`, {
            signal: controller.signal,
            method: 'GET',
            headers: {
                'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
            }
        });

        clearTimeout(timeoutId);

        // If it succeeds (even 401 is OK), it means DNS is working
        sessionStorage.setItem('supabase_probe_result', 'direct');
        return 'direct';
    } catch (error) {
        // Network error or timeout means DNS is blocked
        console.warn('🛡️ [Supabase Probe] Direct connection failed, enabling proxy');
        sessionStorage.setItem('supabase_probe_result', 'proxy');
        enableProxyMode();
        return 'proxy';
    }
}

function resolveSupabaseUrl(): string {
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    if (isProxyMode() && typeof window !== 'undefined') {
        // Point to our local proxy route
        url = window.location.origin + '/supabase-proxy';
        console.warn('🛡️ [Supabase Client] Using Edge Proxy for DNS Bypass');
    }
    return url;
}

export function createClient(): SupabaseClient | null {
    if (!isSupabaseConfigured()) {
        return null;
    }

    const supabaseUrl = resolveSupabaseUrl();
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createBrowserClient(supabaseUrl, supabaseKey);
}

export function getSupabase(): SupabaseClient | null {
    if (!initialized) {
        supabaseInstance = createClient();
        initialized = true;
    }
    return supabaseInstance;
}
