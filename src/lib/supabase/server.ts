import { createServerClient } from '@supabase/ssr';
import { type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabase(): Promise<SupabaseClient> {
    const cookieStore = await cookies();

    // Server-side uses SUPABASE_DIRECT_URL (real Supabase URL, not CF Worker).
    // Vercel servers are not affected by Indian ISP DNS blocks.
    // SUPABASE_DIRECT_URL is a server-only env var — never sent to the browser.
    const supabaseUrl = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

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
    const supabaseUrl = process.env.SUPABASE_DIRECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
    return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
