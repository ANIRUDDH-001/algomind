/**
 * /api/debug-auth — Full system diagnostic (no auth required, safe to call anytime)
 *
 * Checks:
 *  - All required env vars (redacted for safety)
 *  - Supabase direct connectivity
 *  - OAuth provider configuration (Google, GitHub enabled/disabled)
 *  - Active session / cookies
 *  - AI providers (Groq, Gemini)
 *  - Redis/Upstash
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

async function testFetch(url: string, headers: Record<string, string> = {}, timeoutMs = 6000) {
    const start = Date.now();
    try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(t);
        let body: unknown = null;
        try { body = await res.json(); } catch { body = '(non-JSON)'; }
        return { ok: res.ok, status: res.status, body, ms: Date.now() - start, error: null as string | null };
    } catch (e: unknown) {
        return { ok: false, status: null, body: null, ms: Date.now() - start, error: String(e) };
    }
}

function redact(val: string | undefined, show = 12): string {
    if (!val) return 'NOT_SET';
    return `SET — ${val.slice(0, show)}... (${val.length} chars)`;
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const directUrl = process.env.SUPABASE_DIRECT_URL;
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    const isCfWorker = supabaseUrl.includes('workers.dev');

    const authHeaders: Record<string, string> = anonKey
        ? { apikey: anonKey, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' };

    // Run connectivity checks in parallel
    const [supabaseHealth, supabaseSettings, groqHealth, geminiHealth] = await Promise.all([
        supabaseUrl
            ? testFetch(`${supabaseUrl}/auth/v1/health`, authHeaders)
            : Promise.resolve({ ok: false, status: null, body: null, ms: 0, error: 'NEXT_PUBLIC_SUPABASE_URL not set' }),
        supabaseUrl
            ? testFetch(`${supabaseUrl}/auth/v1/settings`, authHeaders)
            : Promise.resolve({ ok: false, status: null, body: null, ms: 0, error: 'NEXT_PUBLIC_SUPABASE_URL not set' }),
        groqKey
            ? testFetch('https://api.groq.com/openai/v1/models', { Authorization: `Bearer ${groqKey}` })
            : Promise.resolve({ ok: false, status: null, body: null, ms: 0, error: 'GROQ_API_KEY not set' }),
        geminiKey
            ? testFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`)
            : Promise.resolve({ ok: false, status: null, body: null, ms: 0, error: 'GEMINI_API_KEY not set' }),
    ]);

    let redisOk = false;
    let redisNote = 'Not configured';
    if (redisUrl && redisToken) {
        const r = await testFetch(`${redisUrl}/ping`, { Authorization: `Bearer ${redisToken}` });
        redisOk = r.ok;
        redisNote = r.ok ? `Connected (${r.ms}ms)` : `Failed: ${r.error ?? r.status}`;
    }

    // Parse OAuth settings
    const settings = supabaseSettings.body as Record<string, unknown> | null;
    const external = (settings?.external ?? {}) as Record<string, boolean>;

    // Cookie audit
    const supabaseCookies = allCookies.filter(c =>
        c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')
    );
    const hasSession = supabaseCookies.some(c =>
        c.name.includes('auth-token') && !c.name.includes('code-verifier')
    );
    const hasVerifier = supabaseCookies.some(c => c.name.includes('code-verifier'));

    // Detect project ref from URL — cookie name should contain it
    const expectedRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] ?? '';
    const sessionCookie = supabaseCookies.find(c => c.name.includes('auth-token') && !c.name.includes('code-verifier'));
    const cookieUrlMatch = sessionCookie
        ? sessionCookie.name.includes(expectedRef)
            ? 'MATCH'
            : `MISMATCH — cookie has "${sessionCookie.name}", expected ref "${expectedRef}"`
        : 'NO_SESSION_COOKIE';

    // Build issues list
    const issues: string[] = [];
    const actions: string[] = [];

    if (!supabaseUrl) {
        issues.push('CRITICAL: NEXT_PUBLIC_SUPABASE_URL is not set');
        actions.push('Vercel → Settings → Environment Variables → add NEXT_PUBLIC_SUPABASE_URL = https://wfdgsmhuglmrxcmwcylz.supabase.co');
    } else if (isCfWorker) {
        issues.push('CRITICAL: NEXT_PUBLIC_SUPABASE_URL points at CF Worker — breaks Google/GitHub OAuth. Must be direct supabase.co URL');
        actions.push('Vercel → Settings → Environment Variables → change NEXT_PUBLIC_SUPABASE_URL to: https://wfdgsmhuglmrxcmwcylz.supabase.co');
    }
    if (!anonKey) {
        issues.push('CRITICAL: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
        actions.push('Vercel → Settings → Environment Variables → add NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    if (!serviceKey) {
        issues.push('CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set — admin APIs will fail');
        actions.push('Vercel → Settings → Environment Variables → add SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!supabaseHealth.ok) {
        issues.push(`CRITICAL: Supabase auth/v1/health failed (${supabaseHealth.status ?? 'timeout'})`);
        actions.push('Check NEXT_PUBLIC_SUPABASE_URL is the correct project URL');
    }
    if (!external.google) {
        issues.push('CRITICAL: Google OAuth is DISABLED in Supabase settings');
        actions.push('Supabase Dashboard → Auth → Providers → Google → Enable + set Client ID/Secret');
    }
    if (!external.github) {
        issues.push('WARNING: GitHub OAuth is DISABLED in Supabase settings');
        actions.push('Supabase Dashboard → Auth → Providers → GitHub → Enable + set Client ID/Secret');
    }
    if (!groqKey) {
        issues.push('WARNING: GROQ_API_KEY missing — Whisper STT + Groq AI routing will fail');
        actions.push('Vercel → Settings → Environment Variables → add GROQ_API_KEY');
    } else if (!groqHealth.ok) {
        issues.push(`WARNING: Groq API returned ${groqHealth.status} — key may be invalid or expired`);
        actions.push('Verify at console.groq.com → API Keys');
    }
    if (!geminiKey) {
        issues.push('WARNING: GEMINI_API_KEY missing — AI interview responses will fail');
        actions.push('Vercel → Settings → Environment Variables → add GEMINI_API_KEY');
    } else if (!geminiHealth.ok) {
        issues.push(`WARNING: Gemini API returned ${geminiHealth.status}`);
    }
    if (!redisOk) {
        issues.push('INFO: Upstash Redis not connected — rate limiting degrades to fail-open');
    }
    if (cookieUrlMatch.startsWith('MISMATCH')) {
        issues.push(`CRITICAL: ${cookieUrlMatch} — session will not persist between requests`);
    }

    const critCount = issues.filter(i => i.startsWith('CRITICAL')).length;
    const verdict = critCount > 0
        ? `RED: ${critCount} CRITICAL issue(s) — fix these first`
        : issues.some(i => i.startsWith('WARNING'))
            ? 'YELLOW: Working but with warnings'
            : 'GREEN: All systems operational';

    return NextResponse.json({
        verdict,
        timestamp: new Date().toISOString(),
        env: {
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl || 'NOT_SET',
            is_cf_worker: isCfWorker,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: redact(anonKey),
            SUPABASE_SERVICE_ROLE_KEY: redact(serviceKey),
            SUPABASE_DIRECT_URL: directUrl ? `SET — ${directUrl}` : 'NOT_SET',
            GROQ_API_KEY: redact(groqKey),
            GEMINI_API_KEY: redact(geminiKey),
            UPSTASH_REDIS_REST_URL: redact(redisUrl, 30),
            UPSTASH_REDIS_REST_TOKEN: redact(redisToken),
        },
        supabase: {
            health_ok: supabaseHealth.ok,
            health_status: supabaseHealth.status,
            health_ms: supabaseHealth.ms,
            version: (supabaseHealth.body as Record<string, unknown>)?.version ?? 'unknown',
            oauth: {
                google: external.google ? 'ENABLED' : 'DISABLED',
                github: external.github ? 'ENABLED' : 'DISABLED',
            },
        },
        ai_providers: {
            groq: { ok: groqHealth.ok, status: groqHealth.status, ms: groqHealth.ms },
            gemini: { ok: geminiHealth.ok, status: geminiHealth.status, ms: geminiHealth.ms },
        },
        redis: { ok: redisOk, note: redisNote },
        session: {
            has_session_cookie: hasSession,
            has_pkce_verifier_cookie: hasVerifier,
            cookie_url_match: cookieUrlMatch,
            all_supabase_cookies: supabaseCookies.map(c => ({ name: c.name, bytes: c.value.length })),
        },
        issues,
        actions_needed: actions,
    });
}
