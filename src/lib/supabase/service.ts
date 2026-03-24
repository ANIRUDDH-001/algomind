import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;
let _serviceUrl: string | null = null;
let _serviceKey: string | null = null;

export function getServiceClient(): SupabaseClient {
    // In serverless, module scope is reset per cold start —
    // this singleton is per-invocation, not truly global
    const url = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('[Supabase Service] Missing SUPABASE_DIRECT_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    if (!_serviceClient || _serviceUrl !== url || _serviceKey !== key) {
        _serviceClient = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
        _serviceUrl = url;
        _serviceKey = key;
    }

    return _serviceClient;
}

export function clearServiceClientCache(): void {
    _serviceClient = null;
    _serviceUrl = null;
    _serviceKey = null;
}
