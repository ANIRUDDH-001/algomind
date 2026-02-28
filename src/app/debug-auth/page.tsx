'use client';

import { useEffect, useState } from 'react';

interface DiagResult {
    verdict: string;
    timestamp: string;
    env: Record<string, string>;
    tests: Record<string, { ok: boolean; status?: number; body?: unknown; error?: string; latencyMs?: number }>;
    cookies: { total_cookies: number; supabase_cookies: { name: string; length: number }[]; has_session_cookie: boolean };
    issues: string[];
    fixes: string[];
}

function Badge({ ok }: { ok: boolean }) {
    return (
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${ok ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {ok ? '✓ PASS' : '✗ FAIL'}
        </span>
    );
}

export default function AuthDebugPage() {
    const [data, setData] = useState<DiagResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [clientTests, setClientTests] = useState<Record<string, unknown>>({});

    useEffect(() => {
        fetch('/api/debug-auth')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError(String(e)); setLoading(false); });
    }, []);

    // Client-side tests
    useEffect(() => {
        const run = async () => {
            const results: Record<string, unknown> = {};

            // 1. Can client reach CF Worker directly?
            const cfUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            results.supabase_url = cfUrl;
            results.anon_key_present = !!anonKey;

            try {
                const start = Date.now();
                const r = await fetch(`${cfUrl}/auth/v1/health`, {
                    headers: { apikey: anonKey ?? '' }
                });
                results.client_cf_auth_health = { ok: r.ok, status: r.status, latencyMs: Date.now() - start };
            } catch (e) {
                results.client_cf_auth_health = { ok: false, error: String(e) };
            }

            // 2. Check localStorage for Supabase session
            try {
                const keys = Object.keys(localStorage).filter(k => k.includes('supabase') || k.includes('sb-'));
                results.localstorage_session_keys = keys;
                results.has_localstorage_session = keys.length > 0;
            } catch {
                results.localstorage_session_keys = 'blocked';
            }

            // 3. Check cookies readable from client
            const cookies = document.cookie.split(';').map(c => c.trim().split('=')[0]);
            results.client_visible_cookies = cookies.filter(c => c.includes('sb-') || c.includes('supabase'));

            setClientTests(results);
        };
        run();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400">Running diagnostics...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 max-w-lg text-red-300">
                    <p className="font-bold mb-2">Diagnostic API failed</p>
                    <p className="text-sm font-mono">{error ?? 'No data returned'}</p>
                    <p className="text-sm mt-2 text-red-400">Make sure debug-auth-route.ts is placed at src/app/api/debug-auth/route.ts and the app is deployed.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">🔍 Auth Diagnostics</h1>
                    <p className="text-slate-400 text-sm mt-1">{data.timestamp}</p>
                </div>

                {/* Verdict */}
                <div className={`p-4 rounded-xl border text-sm font-semibold ${data.verdict.startsWith('🔴') ? 'bg-red-950/50 border-red-500/50 text-red-300' : data.verdict.startsWith('🟡') ? 'bg-amber-950/50 border-amber-500/50 text-amber-300' : 'bg-green-950/50 border-green-500/50 text-green-300'}`}>
                    {data.verdict}
                </div>

                {/* Issues */}
                {data.issues.length > 0 && (
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
                        <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wider">Issues Found</h2>
                        {data.issues.map((issue, i) => (
                            <div key={i} className="text-sm">{issue}</div>
                        ))}
                    </div>
                )}

                {/* Fixes */}
                {data.fixes.length > 0 && (
                    <div className="bg-blue-950/30 border border-blue-700/40 rounded-xl p-4 space-y-2">
                        <h2 className="font-bold text-sm text-blue-300 uppercase tracking-wider">Recommended Fixes</h2>
                        {data.fixes.map((fix, i) => (
                            <div key={i} className="text-sm text-blue-200">{fix}</div>
                        ))}
                    </div>
                )}

                {/* Server Tests */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">Server-Side Tests</h2>
                    <div className="space-y-3">
                        {Object.entries(data.tests).map(([name, result]) => (
                            <div key={name} className="flex flex-col gap-1">
                                <div className="flex items-center gap-3">
                                    <Badge ok={result.ok} />
                                    <span className="font-mono text-sm text-slate-200">{name}</span>
                                    {result.latencyMs && <span className="text-xs text-slate-500">{result.latencyMs}ms</span>}
                                    {result.status && <span className="text-xs text-slate-500">HTTP {result.status}</span>}
                                </div>
                                {result.error && (
                                    <div className="ml-16 text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1">{result.error}</div>
                                )}
                                {result.ok && result.body ? (
                                    <div className="ml-16 text-xs text-green-400 font-mono bg-green-950/20 rounded px-2 py-1 truncate">
                                        {String(JSON.stringify(result.body)).slice(0, 200)}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Client Tests */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">Client-Side Tests (Browser)</h2>
                    <pre className="text-xs text-slate-300 overflow-auto font-mono whitespace-pre-wrap bg-slate-950 rounded p-3">
                        {JSON.stringify(clientTests, null, 2)}
                    </pre>
                </div>

                {/* Env */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">Environment Variables</h2>
                    {Object.entries(data.env).map(([k, v]) => (
                        <div key={k} className="flex gap-3 py-1 border-b border-slate-800 last:border-0">
                            <span className="font-mono text-xs text-slate-400 w-64 shrink-0">{k}</span>
                            <span className="font-mono text-xs text-slate-200 break-all">{v}</span>
                        </div>
                    ))}
                </div>

                {/* Cookies */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                    <h2 className="font-bold text-sm text-slate-300 uppercase tracking-wider mb-3">Session / Cookie State</h2>
                    <div className="space-y-1 text-sm">
                        <div>Total server-readable cookies: <span className="text-amber-400 font-mono">{data.cookies.total_cookies}</span></div>
                        <div>Supabase auth cookies: <span className={`font-mono ${data.cookies.supabase_cookies.length > 0 ? 'text-green-400' : 'text-red-400'}`}>{data.cookies.supabase_cookies.length}</span></div>
                        <div>Has session cookie: <span className={`font-mono ${data.cookies.has_session_cookie ? 'text-green-400' : 'text-red-400'}`}>{String(data.cookies.has_session_cookie)}</span></div>
                        {data.cookies.supabase_cookies.map(c => (
                            <div key={c.name} className="font-mono text-xs text-slate-400 pl-4">• {c.name} ({c.length} bytes)</div>
                        ))}
                    </div>
                </div>

                <div className="text-xs text-slate-600 pb-8">
                    Share the full contents of this page (screenshot or copy-paste) for further diagnosis.
                    Remove this page from production once issues are resolved.
                </div>
            </div>
        </div>
    );
}
