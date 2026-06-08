/**
 * @codesage
 * @file      src/app/api/health/connectivity/route.ts
 * @purpose   Tests connectivity to both proxy and direct Supabase instances.
 * @tech      Next.js, fetch
 * @connects  None
 * @apis      Supabase /auth/v1/health (proxy & direct)
 * @db        None
 * @state     None
 * @env       NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DIRECT_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * @issues    None found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const directUrl = process.env.SUPABASE_DIRECT_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const results: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
    };

    // Test CF Worker (or direct URL)
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
            headers: { apikey: anonKey! },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        results.proxy = { reachable: true, status: res.status, url: supabaseUrl };
    } catch (err) {
        results.proxy = { reachable: false, error: String(err), url: supabaseUrl };
    }

    // Test direct Supabase (server-side check)
    if (directUrl && directUrl !== supabaseUrl) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`${directUrl}/auth/v1/health`, {
                headers: { apikey: anonKey! },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            results.direct = { reachable: true, status: res.status };
        } catch (err) {
            results.direct = { reachable: false, error: String(err) };
        }
    }

    const allHealthy = Object.values(results)
        .filter(v => typeof v === 'object' && v !== null && 'reachable' in (v as object))
        .every(v => (v as { reachable: boolean }).reachable);

    return NextResponse.json(
        {
            ...results,
            all_services_ok: allHealthy,
        },
        { status: 200 }
    );
}
