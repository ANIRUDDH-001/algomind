'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, XCircle, Globe, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ServerFlag {
    value: boolean;
    description: string;
}

export default function FeaturesAdminPage() {
    const [flags, setFlags] = useState<Record<string, ServerFlag>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

    const fetchFlags = useCallback(async () => {
        try {
            setError(null);
            const res = await fetch('/api/flags');
            if (!res.ok) throw new Error(`Failed to fetch flags (${res.status})`);
            const data = await res.json();
            setFlags(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load flags');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFlags();
    }, [fetchFlags]);

    const handleToggle = async (key: string, value: boolean) => {
        setTogglingFlag(key);
        try {
            const res = await fetch('/api/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, isEnabled: value }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Failed (${res.status})`);
            }
            // Optimistic local update
            setFlags(prev => ({
                ...prev,
                [key]: { ...prev[key], value },
            }));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Toggle failed');
            await fetchFlags(); // Refresh to get actual state
        } finally {
            setTogglingFlag(null);
        }
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
                            Server-side kill switches — changes propagate within 30 seconds
                        </p>
                    </div>
                    <Button
                        onClick={() => { setLoading(true); fetchFlags(); }}
                        variant="outline"
                        className="border-[var(--surface-edge)] text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors"
                        style={{ background: 'var(--surface-2)' }}
                    >
                        <Loader2 className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Propagation warning */}
                <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20 flex items-center gap-3 text-amber-400 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Changes take effect within 30 seconds for all users via Redis cache invalidation.
                </div>

                {loading ? (
                    <div className="rounded-2xl p-12 flex items-center justify-center gap-3 text-zinc-500" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading flags…
                    </div>
                ) : error ? (
                    <div className="rounded-2xl p-6 flex items-center gap-3 text-red-400 bg-red-500/5 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                        <Button
                            onClick={() => { setLoading(true); setError(null); fetchFlags(); }}
                            variant="outline"
                            className="ml-auto text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {Object.entries(flags).map(([key, flag]) => (
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
                                                Global
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
                                            onCheckedChange={(checked) => handleToggle(key, checked)}
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
        </div>
    );
}
