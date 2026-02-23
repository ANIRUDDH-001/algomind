'use client';

/**
 * Admin — Cache Stats
 *
 * Fetches from /api/admin/cache-stats so we read actual server-side state,
 * not a fresh client-side instance (which always shows zeroes).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, Trash2 } from 'lucide-react';
import type { CacheStats } from '@/lib/ai/response-cache';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/50 space-y-1">
            <div className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</div>
            <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
            {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
        </div>
    );
}

export default function CacheStatsPage() {
    const [stats, setStats] = useState<CacheStats | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

    const refresh = useCallback(async (manual = false) => {
        if (manual) setIsRefreshing(true);
        try {
            const res = await fetch('/api/admin/cache-stats', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setStats(data.stats ?? null);
            setEnabled(data.enabled ?? false);
            setLastRefreshed(new Date());
            if (manual) toast.success('Cache stats refreshed');
        } catch (err) {
            console.error('[Cache Stats] Failed to load:', err);
            if (manual) toast.error('Failed to refresh cache stats');
        } finally {
            setIsLoading(false);
            if (manual) setIsRefreshing(false);
        }
    }, []);

    const handleClear = async () => {
        setIsClearing(true);
        try {
            const res = await fetch('/api/admin/cache-stats', { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success('Cache cleared');
            await refresh();
        } catch {
            toast.error('Failed to clear cache');
        } finally {
            setIsClearing(false);
        }
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(() => refresh(), 10000);
        return () => clearInterval(interval);
    }, [refresh]);

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-3xl mx-auto space-y-8">

                {/* Header with refresh + clear buttons */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight">Response Cache</h1>
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            In-memory cache for AI responses to common queries.
                            {lastRefreshed && (
                                <span className="text-slate-600 text-xs">
                                    · Updated {lastRefreshed.toLocaleTimeString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleClear}
                            disabled={isClearing || isLoading}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 hover:border-red-700/70 text-red-400 hover:text-red-300 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Clear Cache
                        </button>
                        <button
                            onClick={() => refresh(true)}
                            disabled={isRefreshing || isLoading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing…' : 'Refresh Stats'}
                        </button>
                    </div>
                </div>

                {/* Warning Banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                    <div className="text-xl">⚠️</div>
                    <div className="space-y-1">
                        <p className="text-amber-400 font-bold text-sm">In-memory Cache — Serverless Limitation</p>
                        <p className="text-amber-400/80 text-xs leading-relaxed">
                            This cache lives in the server process memory. On Vercel (serverless), each function invocation is isolated — stats reset on every cold start and won&apos;t accumulate across requests. Stats shown here reflect only the <strong>current warm instance</strong>. Entries are backed by Redis when available, but hit/miss counters are always per-instance.
                        </p>
                    </div>
                </div>

                {isLoading && (
                    <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Loading cache stats…
                    </div>
                )}

                {!isLoading && (
                    <>
                        {/* Status */}
                        <div className={`p-3 rounded-lg border text-xs font-bold uppercase tracking-widest ${enabled
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}>
                            {enabled ? '● Cache Enabled' : '○ Cache Disabled'}
                            {!enabled && (
                                <span className="ml-2 font-normal normal-case text-slate-500">
                                    Enable via Feature Flags → ENABLE_RESPONSE_CACHE
                                </span>
                            )}
                        </div>

                        {stats && (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <StatCard label="Entries" value={stats.entries} sub="of 100 max" />
                                    <StatCard
                                        label="Hit Rate"
                                        value={`${stats.hitRate}%`}
                                        sub={`${stats.totalHits} hits / ${stats.totalMisses} misses`}
                                    />
                                    <StatCard
                                        label="Memory"
                                        value={formatBytes(stats.memorySizeBytes)}
                                        sub={`of ${formatBytes(stats.maxMemoryBytes)}`}
                                    />
                                    <StatCard
                                        label="Avg Latency Saved"
                                        value={`${stats.avgLatencySaved}ms`}
                                        sub="per cache hit"
                                    />
                                </div>

                                {/* Memory bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                        <span>Memory Usage</span>
                                        <span>{formatBytes(stats.memorySizeBytes)} / {formatBytes(stats.maxMemoryBytes)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                                            style={{ width: `${Math.min(100, (stats.memorySizeBytes / stats.maxMemoryBytes) * 100)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Top Queries */}
                                {stats.topQueries.length > 0 ? (
                                    <div className="space-y-3">
                                        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Top Queries</h2>
                                        <div className="space-y-1">
                                            {stats.topQueries.map((q, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/50 text-xs"
                                                >
                                                    <span className="text-[10px] font-black text-slate-600 w-5 text-right">{i + 1}</span>
                                                    <span className="flex-1 text-slate-300 truncate">{q.query}</span>
                                                    <span className="text-[10px] font-mono text-slate-500 uppercase">{q.model}</span>
                                                    <span className="text-[10px] font-bold text-blue-400 tabular-nums min-w-[40px] text-right">
                                                        {q.hitCount} hits
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/50 text-slate-500 text-sm text-center">
                                        No cached queries yet — cache warms up during active interview sessions.
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}