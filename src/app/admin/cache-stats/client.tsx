'use client';

/**
 * Admin — Cache Stats
 *
 * Displays response cache statistics: hit rate, memory usage, top queries,
 * and provides controls to clear the cache.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getResponseCache, type CacheStats } from '@/lib/ai/response-cache';
import { getFeatureFlag } from '@/lib/feature-flags';

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

    const refresh = useCallback(() => {
        setEnabled(getFeatureFlag('ENABLE_RESPONSE_CACHE'));
        try {
            const cache = getResponseCache();
            setStats(cache.getStats());
        } catch {
            setStats(null);
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 3000);
        return () => clearInterval(interval);
    }, [refresh]);

    const handleClear = () => {
        const cache = getResponseCache();
        cache.clear();
        refresh();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 lg:p-10">
            <div className="max-w-3xl mx-auto space-y-8">
                {/* Header */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">Response Cache</h1>
                    <p className="text-sm text-slate-400">
                        In-memory cache for AI responses to common queries.
                    </p>
                </div>

                {/* Warning Banner */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                    <div className="text-xl">⚠️</div>
                    <div className="space-y-1">
                        <p className="text-amber-400 font-bold text-sm">In-memory Cache Warning</p>
                        <p className="text-amber-400/80 text-xs leading-relaxed">
                            This cache is stored in-memory. In serverless deployments (like Vercel), stats and entries are reset on every cold start.
                            It is not effective for production traffic unless a persistent backend (like Redis) is implemented.
                        </p>
                    </div>
                </div>

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
                            <StatCard label="Entries" value={stats.entries} sub={`of 100 max`} />
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
                        {stats.topQueries.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Top Queries</h2>
                                <div className="space-y-1">
                                    {stats.topQueries.map((q, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/40 border border-slate-800/50 text-xs"
                                        >
                                            <span className="text-[10px] font-black text-slate-600 w-5 text-right">
                                                {i + 1}
                                            </span>
                                            <span className="flex-1 text-slate-300 truncate">
                                                {q.query}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-500 uppercase">
                                                {q.model}
                                            </span>
                                            <span className="text-[10px] font-bold text-blue-400 tabular-nums min-w-[40px] text-right">
                                                {q.hitCount} hits
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="pt-4 border-t border-slate-800/50 flex gap-3">
                            <button
                                onClick={handleClear}
                                className="text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-widest transition-colors"
                            >
                                Clear Cache
                            </button>
                            <button
                                onClick={refresh}
                                className="text-xs text-slate-400 hover:text-slate-300 font-bold uppercase tracking-widest transition-colors"
                            >
                                Refresh
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
