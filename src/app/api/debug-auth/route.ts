import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

interface TestResult {
    ok: boolean;
    status?: number;
    body?: unknown;
    error?: string;
    latencyMs?: number;
}

async function testEndpoint(url: string, headers: Record<string, string> = {}): Promise<TestResult> {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeout);
        let body: unknown;
        try { body = await res.json(); } catch { body = await res.text().catch(() => '(unreadable)'); }
        return { ok: res.ok, status: res.status, body, latencyMs: Date.now() - start };
    } catch (e: unknown) {
        return { ok: false, error: String(e), latencyMs: Date.now() - start };
    }
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const cfWorkerUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)';
    const directUrl = process.env.SUPABASE_DIRECT_URL ?? '(not set)';
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '(not set)';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '(not set)';

    const authHeaders = { apikey: anonKey, 'Content-Type': 'application/json' };

    // ── Run all tests in parallel ──────────────────────────────────────────────
    const [
        cfHealth,
        cfAuthHealth,
        cfAuthSettings,
        directHealth,
        directAuthHealth,
    ] = await Promise.all([
        testEndpoint(`${cfWorkerUrl}/cf-health`),
        testEndpoint(`${cfWorkerUrl}/auth/v1/health`, authHeaders),
        testEndpoint(`${cfWorkerUrl}/auth/v1/settings`, authHeaders),
        directUrl !== '(not set)' ? testEndpoint(`${directUrl}/auth/v1/health`, authHeaders) : Promise.resolve({ ok: false, error: 'SUPABASE_DIRECT_URL not set' } as TestResult),
        directUrl !== '(not set)' ? testEndpoint(`${directUrl}/auth/v1/settings`, authHeaders) : Promise.resolve({ ok: false, error: 'SUPABASE_DIRECT_URL not set' } as TestResult),
    ]);

    // ── Cookie Analysis ────────────────────────────────────────────────────────
    const supabaseCookies = allCookies.filter(c =>
        c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')
    );
    const hasSession = supabaseCookies.some(c => c.name.includes('auth-token'));

    // ── Diagnose issues ────────────────────────────────────────────────────────
    const issues: string[] = [];
    const fixes: string[] = [];

    if (!cfHealth.ok) {
        issues.push('❌ CF Worker is not reachable or has no /cf-health endpoint');
        fixes.push('The CF Worker may not be properly proxying. Check worker code at Cloudflare dashboard → Workers → algomind-supabase → Edit code');
    }

    if (!cfAuthHealth.ok) {
        issues.push('❌ CF Worker is NOT proxying /auth/v1/* endpoints — this is the main auth failure cause');
        fixes.push('The CF Worker must forward /auth/v1/* to Supabase. Without this, NO auth method works when using CF Worker URL as NEXT_PUBLIC_SUPABASE_URL');
    }

    if (cfAuthHealth.ok && !directAuthHealth.ok) {
        issues.push('⚠️ CF Worker auth works but direct Supabase is unreachable from server (Indian ISP blocking server too? Unlikely but possible)');
    }

    if (cfAuthHealth.ok && directAuthHealth.ok) {
        issues.push('✅ Both CF Worker auth proxy and direct Supabase are reachable');
        fixes.push('Auth endpoints are reachable. Issue is likely in PKCE/cookie flow — check /auth/callback route');
    }

    if (anonKey === '(not set)') {
        issues.push('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
        fixes.push('Add NEXT_PUBLIC_SUPABASE_ANON_KEY to Vercel environment variables');
    }

    if (serviceKey === '(not set)') {
        issues.push('❌ SUPABASE_SERVICE_ROLE_KEY is missing');
        fixes.push('Add SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables');
    }

    if (supabaseCookies.length === 0) {
        issues.push('⚠️ No Supabase auth cookies found on server — session is not persisted server-side');
    }

    // Check if the CF worker URL looks correct
    if (!cfWorkerUrl.includes('workers.dev') && !cfWorkerUrl.includes('supabase.co')) {
        issues.push('❌ NEXT_PUBLIC_SUPABASE_URL does not look like a valid Supabase or CF Worker URL');
    }

    if (cfWorkerUrl.includes('supabase.co')) {
        issues.push('⚠️ NEXT_PUBLIC_SUPABASE_URL is pointing directly to supabase.co (not CF Worker) — Indian users on mobile data will be blocked');
        fixes.push('Change NEXT_PUBLIC_SUPABASE_URL to your CF Worker URL: https://algomind-supabase.aniruddhvijay2k7.workers.dev');
    }

    // ── Final verdict ──────────────────────────────────────────────────────────
    const verdict = !cfAuthHealth.ok
        ? '🔴 CRITICAL: CF Worker is not proxying /auth/v1/* — this is why all auth fails'
        : !directAuthHealth.ok
            ? '🟡 WARNING: Direct Supabase unreachable from server (unusual)'
            : '🟢 Infrastructure OK — check PKCE/callback flow';

    return NextResponse.json({
        verdict,
        timestamp: new Date().toISOString(),
        env: {
            NEXT_PUBLIC_SUPABASE_URL: cfWorkerUrl,
            SUPABASE_DIRECT_URL: directUrl,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey !== '(not set)' ? `${anonKey.slice(0, 20)}...` : '(not set)',
            SUPABASE_SERVICE_ROLE_KEY: serviceKey !== '(not set)' ? `${serviceKey.slice(0, 20)}...` : '(not set)',
        },
        tests: {
            cf_worker_health: cfHealth,
            cf_worker_auth_proxy: cfAuthHealth,
            cf_worker_auth_settings: cfAuthSettings,
            direct_supabase_auth_health: directHealth,
            direct_supabase_auth_settings: directAuthHealth,
        },
        cookies: {
            total_cookies: allCookies.length,
            supabase_cookies: supabaseCookies.map(c => ({ name: c.name, length: c.value.length })),
            has_session_cookie: hasSession,
        },
        issues,
        fixes,
    }, { status: 200 });
}
