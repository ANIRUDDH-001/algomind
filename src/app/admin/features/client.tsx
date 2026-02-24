'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAllFeatureFlags, setFeatureFlag, type FeatureFlagKey } from '@/lib/feature-flags';
import { AlertCircle, CheckCircle2, XCircle, Globe, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types for server-side flags
// ---------------------------------------------------------------------------
interface ServerFlag {
    value: boolean;
    description: string;
}

export default function FeaturesAdminPage() {
    const [flags, setFlags] = useState(getAllFeatureFlags());
    const [refreshKey, setRefreshKey] = useState(0);

    // ── Server-side flags ─────────────────────────────────────────────
    const [serverFlags, setServerFlags] = useState<Record<string, ServerFlag>>({});
    const [serverLoading, setServerLoading] = useState(true);
    const [serverError, setServerError] = useState<string | null>(null);
    const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

    const fetchServerFlags = useCallback(async () => {
        try {
            setServerError(null);
            const res = await fetch('/api/flags');
            if (!res.ok) throw new Error(`Failed to fetch flags (${res.status})`);
            const data = await res.json();
            setServerFlags(data);
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Failed to load server flags');
        } finally {
            setServerLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServerFlags();
    }, [fetchServerFlags]);

    const handleServerToggle = async (flag: string, value: boolean) => {
        setTogglingFlag(flag);
        try {
            const res = await fetch('/api/flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ flag, value }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Failed (${res.status})`);
            }
            // Update local state immediately
            setServerFlags(prev => ({
                ...prev,
                [flag]: { ...prev[flag], value },
            }));
        } catch (err) {
            setServerError(err instanceof Error ? err.message : 'Toggle failed');
            // Refresh to get actual state
            await fetchServerFlags();
        } finally {
            setTogglingFlag(null);
        }
    };

    useEffect(() => {
        // Refresh flags when the component mounts or when refreshKey changes
        setFlags(getAllFeatureFlags());
    }, [refreshKey]);

    const handleToggle = (key: FeatureFlagKey, value: boolean) => {
        setFeatureFlag(key, value);
        setRefreshKey(prev => prev + 1);
    };

    const resetToDefaults = () => {
        flags.forEach(flag => {
            setFeatureFlag(flag.key, flag.defaultValue);
        });
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Feature Flags
                        </h1>
                        <p className="text-zinc-400 mt-2 font-medium">
                            Control voice interview features in production
                        </p>
                    </div>
                    <Button
                        onClick={resetToDefaults}
                        variant="outline"
                        className="border-[var(--surface-edge)] text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors"
                        style={{ background: 'var(--surface-2)' }}
                    >
                        Reset to Defaults
                    </Button>
                </div>

                {/* ── Server-Side Flags ──────────────────────────────────── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        <h2 className="text-lg font-bold text-zinc-200">Server-Side Flags</h2>
                        <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] uppercase tracking-widest font-bold">
                            Global
                        </Badge>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium">
                        These flags are controlled server-side and affect all users. Changes take effect immediately.
                    </p>

                    {serverLoading ? (
                        <div className="rounded-2xl p-8 flex items-center justify-center gap-3 text-zinc-500" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading server flags…
                        </div>
                    ) : serverError ? (
                        <div className="rounded-2xl p-6 flex items-center gap-3 text-red-400 bg-red-500/5 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium">{serverError}</span>
                            <Button
                                onClick={() => { setServerLoading(true); fetchServerFlags(); }}
                                variant="outline"
                                className="ml-auto text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                            >
                                Retry
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {Object.entries(serverFlags).map(([key, flag]) => (
                                <div key={key} className="rounded-2xl p-5 transition-all hover:border-zinc-700/50" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-3">
                                                <h3 className="text-base font-bold text-zinc-200">
                                                    {key.replace('ENABLE_', '').replace(/_/g, ' ')}
                                                </h3>
                                                {flag.value ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5 pl-1.5 pr-2.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Enabled
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-zinc-500 border border-[var(--surface-edge)] gap-1.5 pl-1.5 pr-2.5" style={{ background: 'var(--surface-2)' }}>
                                                        <XCircle className="w-3.5 h-3.5" />
                                                        Disabled
                                                    </Badge>
                                                )}
                                                <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 gap-1 pl-1 pr-2 text-[9px] uppercase tracking-widest font-bold">
                                                    <Globe className="w-3 h-3" />
                                                    Server
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                                                {flag.description}
                                            </p>
                                        </div>
                                        <div className="relative">
                                            {togglingFlag === key && (
                                                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 absolute -left-6 top-1.5" />
                                            )}
                                            <Switch
                                                checked={flag.value}
                                                onCheckedChange={(checked) => handleServerToggle(key, checked)}
                                                disabled={togglingFlag === key}
                                                className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-zinc-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Client-Side Flags ──────────────────────────────────── */}
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-zinc-200">Client-Side Flags</h2>
                    <p className="text-xs text-zinc-500 font-medium">
                        These flags are stored in localStorage and only affect this browser.
                    </p>

                    <div className="grid gap-4">
                        {flags.map((flag) => (
                            <div key={flag.key} className="rounded-2xl p-6 transition-all hover:border-zinc-700/50" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-lg font-bold text-zinc-200">
                                                {flag.key.replace('ENABLE_', '').replace(/_/g, ' ')}
                                            </h3>

                                            {flag.currentValue ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 gap-1.5 pl-1.5 pr-2.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Enabled
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-zinc-500 border border-[var(--surface-edge)] gap-1.5 pl-1.5 pr-2.5" style={{ background: 'var(--surface-2)' }}>
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Disabled
                                                </Badge>
                                            )}

                                            {!flag.browserSupported && (
                                                <Badge variant="destructive" className="gap-1.5 bg-red-500/10 text-red-400 border-red-500/20">
                                                    <AlertCircle className="w-3.5 h-3.5" />
                                                    Unsupported Browser
                                                </Badge>
                                            )}
                                        </div>

                                        <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                                            {flag.description}
                                        </p>

                                        {(flag.key === 'ENABLE_SMART_ROUTING' || flag.key === 'ENABLE_RESPONSE_CACHE') && (
                                            <div className="flex items-center gap-2 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-500 font-bold uppercase w-fit">
                                                <AlertCircle className="w-3 h-3" />
                                                Server-side flag — must be set in Vercel env vars to take effect. Toggle only affects local preview.
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 pt-1">
                                            <span>Default: {flag.defaultValue ? 'Enabled' : 'Disabled'}</span>
                                            {flag.requiresBrowserSupport && (
                                                <span className="flex items-center gap-1.5 text-amber-500/70">
                                                    <AlertCircle className="w-3 h-3" />
                                                    Requires Browser Support
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <Switch
                                        checked={flag.currentValue}
                                        onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                                        disabled={!flag.browserSupported}
                                        className="data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-zinc-700"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-2xl p-6 bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-900/5">
                    <h3 className="font-bold mb-3 flex items-center gap-2 text-indigo-400">
                        <AlertCircle className="w-4 h-4" />
                        Rollout Strategy
                    </h3>
                    <ul className="space-y-2 text-sm text-indigo-200/70 font-medium">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                            Week 1: Internal testing (VAD disabled per default)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                            Week 2: Enable VAD for 10% of users (A/B test)
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                            Week 3: Increase to 50% if metrics good
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                            Week 4: Full rollout or rollback based on data
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

