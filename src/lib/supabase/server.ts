import { createServerClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabase(): Promise<SupabaseClient> {
    const cookieStore = await cookies();

    // ⚠️ CRITICAL: Must use NEXT_PUBLIC_SUPABASE_URL (same as client) here.
    // Supabase SSR derives the cookie name from the project URL.
    // If server uses SUPABASE_DIRECT_URL (wfdgsmhuglmrxcmwcylz.supabase.co) and
    // client uses NEXT_PUBLIC_SUPABASE_URL (algomind-supabase.workers.dev),
    // they produce DIFFERENT cookie names → server can never read client session.
    // Fix: use the same URL everywhere so cookie names always match.
    // The CF Worker is reachable from Vercel servers (it's globally accessible).
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

    return createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // Ignore — this runs in Server Components where cookies are read-only
                    }
                },
            },
        }
    );
}

// Service-role client for admin operations (bypasses RLS)
export async function createServiceRoleSupabase(): Promise<SupabaseClient> {
    const { createClient } = await import('@supabase/supabase-js');
    // Service role client uses direct URL (no cookie auth, purely JWT-based)
    const supabaseUrl = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
