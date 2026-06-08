'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle, CheckCircle2, ServerCrash,
    Database, Users, Activity, Loader2, Clock, XCircle, RefreshCw, Play, Zap, Shield, Briefcase
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';
import { COLORS } from '@/lib/design-tokens';

interface SystemEvent {
    id: string;
    type: string;
    model_id: string | null;
    user_id: string | null;
    error_code: string | null;
    error_message: string | null;
    metadata: any;
    created_at: string;
}

interface AnalyticsRow {
    event_date: string;
    type: string;
    count: number;
}

interface ModelStat {
    modelId: string;
    rateLimitHits24h: number;
    lastRateLimitHit: string | null;
    status: string;
}

interface SystemStats {
    total_users: number;
    active_models: number;
    total_sessions: number;
}

export function OverviewClient({ 
    totalUsers, 
    totalAdmins, 
    totalEmployers,
    initialEventsData,
    initialModelsData
}: { 
    totalUsers: number, 
    totalAdmins: number, 
    totalEmployers: number;
    initialEventsData?: any;
    initialModelsData?: any;
}) {
    const [events, setEvents] = useState<SystemEvent[]>(initialEventsData?.events || []);
    const [analytics, setAnalytics] = useState<AnalyticsRow[]>(initialEventsData?.analytics || []);
    const [models, setModels] = useState<ModelStat[]>(initialModelsData?.models || []);
    // @ts-expect-error -- automated unused local suppression
    const [systemStats, setSystemStats] = useState<SystemStats | null>(initialEventsData?.systemStats || null);
    const [isLoading, setIsLoading] = useState(!initialEventsData);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [expandedDbErrors, setExpandedDbErrors] = useState<Record<string, boolean>>({});
    const [isTriggeringCron, setIsTriggeringCron] = useState(false);
    const [cronTriggerStatus, setCronTriggerStatus] = useState<'idle' | 'dispatched' | 'error'>('idle');

    const loadData = async (manual = false) => {
        if (manual) setIsRefreshing(true);
        try {
            const [eventsRes, modelsRes] = await Promise.all([
                fetch('/api/admin/events?days=7&limit=500', { cache: 'no-store' }),
                fetch('/api/admin/models', { cache: 'no-store' })
            ]);

            const eventsData = await eventsRes.json();
            const modelsData = await modelsRes.json();

            setEvents(eventsData.events || []);
            setAnalytics(eventsData.analytics || []);
            setSystemStats(eventsData.systemStats || null);
            setModels(modelsData.models || []);
            setLastRefreshed(new Date());
            if (manual) toast.success('Dashboard refreshed');
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            toast.error('Failed to load system analytics');
        } finally {
            setIsLoading(false);
            if (manual) setIsRefreshing(false);
        }
    };

    const handleTriggerCron = async () => {
        if (!confirm('This will re-run ALL nightly batch jobs.\n\nNote: Some jobs consume LLM API credits per active user.\n\nContinue?')) return;
        setIsTriggeringCron(true);
        setCronTriggerStatus('idle');
        try {
            const res = await fetch('/api/admin/trigger-cron', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Trigger failed');
            setCronTriggerStatus('dispatched');
            toast.success('Batch dispatched via GitHub Actions. Results appear in ~10–20 min as this page auto-refreshes.');
        } catch (err) {
            setCronTriggerStatus('error');
            toast.error('Trigger failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setIsTriggeringCron(false);
        }
    };

    useEffect(() => {
        loadData();
        let currentInterval = 60000;
        const MAX_INTERVAL = 300000;
        let consecutiveErrors = 0;
        let timer: ReturnType<typeof setTimeout>;

        const poll = async () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
                timer = setTimeout(poll, currentInterval);
                return;
            }
            try {
                await loadData();
                consecutiveErrors = 0;
                currentInterval = 60000;
            } catch {
                consecutiveErrors++;
                currentInterval = Math.min(60000 * Math.pow(2, consecutiveErrors), MAX_INTERVAL);
            }
            timer = setTimeout(poll, currentInterval);
        };

        timer = setTimeout(poll, currentInterval);

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadData();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const toggleDbError = (id: string) => {
        setExpandedDbErrors(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const chartData = (Array.isArray(analytics) ? analytics : []).reduce((acc, curr) => {
        const dateString = curr.event_date;
        let dayData = acc.find((d: any) => d.name === dateString);
        if (!dayData) {
            dayData = { name: dateString };
            acc.push(dayData);
        }
        dayData[curr.type] = curr.count;
        return acc;
    }, [] as any[]).sort((a: any, b: any) => new Date(a.name).getTime() - new Date(b.name).getTime());

    const typeColors: Record<string, string> = {
        'ai.model_429': COLORS.chart[0],
        'model_429': COLORS.chart[0],
        'ai.model_deprecated': COLORS.chart[1],
        'model_deprecated': COLORS.chart[1],
        'ai.model_error': COLORS.chart[2],
        'model_error': COLORS.chart[2],
        'ai.model_timeout': COLORS.chart[3],
        'model_timeout': COLORS.chart[3],
        'ai.model_verification_failed': COLORS.chart[4],
        'model_verification_failed': COLORS.chart[4],
        'db.error': COLORS.semantic.danger,
        'db_error': COLORS.semantic.danger,
        'client_error': '#94a3b8',
        'kg_cache_miss': '#d8b4fe',
        'rate_limit.user_exceeded': '#3b82f6',
        'user_rate_limit': '#3b82f6',
        'integration.leetcode_fetch_failed': '#a855f7',
        'leetcode_fetch_failed': '#a855f7',
        'integration.piston_error': '#f97316',
        'piston_error': '#f97316',
        'ai.embedding_failed': '#ec4899',
        'embedding_failed': '#ec4899',
        'cron.completed': COLORS.semantic.success,
        'cron_completed': COLORS.semantic.success,
        'cron.failed': COLORS.semantic.danger,
        'cron_failed': COLORS.semantic.danger,
        'cron.triggered': '#6366f1',
        'cron_triggered': '#6366f1',
        'cron.running': '#3b82f6',
        'cron_running': '#3b82f6',
        'batch.completed': '#14b8a6',
        'batch_job_complete': '#14b8a6',
        'auth.admin_action': '#64748b',
        'admin_action': '#64748b',
    };

    const chartKeys = Array.from(new Set((Array.isArray(analytics) ? analytics : []).map(a => a.type)));

    const rateLimitedModels = (Array.isArray(models) ? models : [])
        .filter(m => m.rateLimitHits24h > 0)
        .sort((a, b) => b.rateLimitHits24h - a.rateLimitHits24h);

    const dbErrors = (Array.isArray(events) ? events : []).filter(e => e.type === 'db_error' || e.type === 'db.error').slice(0, 20);

    const userRateLimits = (Array.isArray(events) ? events : []).filter(e => e.type === 'user_rate_limit' || e.type === 'rate_limit.user_exceeded');

    const userRateLimitsByHour = userRateLimits.reduce((acc, curr) => {
        const hour = new Date(curr.created_at).getHours() + ':00';
        let hourData = acc.find((d: any) => d.hour === hour);
        if (!hourData) {
            hourData = { hour, count: 0 };
            acc.push(hourData);
        }
        hourData.count++;
        return acc;
    }, [] as any[]).sort((a: any, b: any) => parseInt(a.hour) - parseInt(b.hour));

    const cronEvents = events.filter(e =>
        e.type === 'cron.completed' || e.type === 'cron_completed' ||
        e.type === 'cron.failed' || e.type === 'cron_failed' ||
        e.type === 'cron.triggered' || e.type === 'cron_triggered' ||
        e.type === 'cron.running' || e.type === 'cron_running'
    ).slice(0, 20);

    const resolvedCronRows = cronEvents
        .filter(e => e.type === 'cron.triggered' || e.type === 'cron_triggered')
        .map(triggered => {
            const triggeredTime = new Date(triggered.created_at).getTime();
            const followUp = cronEvents.find(e =>
                (
                    e.type === 'cron.running' || e.type === 'cron_running' ||
                    e.type === 'cron.completed' || e.type === 'cron_completed' ||
                    e.type === 'cron.failed' || e.type === 'cron_failed'
                ) &&
                new Date(e.created_at).getTime() > triggeredTime
            );
            const terminalFollowUp = followUp?.type === 'cron.running' || followUp?.type === 'cron_running'
                ? cronEvents.find(e =>
                    (
                        e.type === 'cron.completed' || e.type === 'cron_completed' ||
                        e.type === 'cron.failed' || e.type === 'cron_failed'
                    ) &&
                    new Date(e.created_at).getTime() > triggeredTime
                ) || followUp
                : followUp;
            return {
                triggered,
                followUp: terminalFollowUp,
                resolvedStatus: terminalFollowUp?.type ?? 'cron.triggered',
                resolvedMetadata: terminalFollowUp?.metadata ?? triggered.metadata,
            };
        })
        .slice(0, 10);

    const lastCronRun = cronEvents.length > 0 ? new Date(cronEvents[0].created_at).getTime() : 0;
    const isCronStale = lastCronRun > 0 && (Date.now() - lastCronRun) > (26 * 60 * 60 * 1000);

    const getRelativeTime = (isoDate: string | null) => {
        if (!isoDate) return 'Never';
        const msPerMinute = 60 * 1000;
        const msPerHour = msPerMinute * 60;
        const msPerDay = msPerHour * 24;
        const elapsed = Date.now() - new Date(isoDate).getTime();
        if (elapsed < msPerMinute) return Math.round(elapsed / 1000) + 's ago';
        if (elapsed < msPerHour) return Math.round(elapsed / msPerMinute) + 'm ago';
        if (elapsed < msPerDay) return Math.round(elapsed / msPerHour) + 'h ago';
        return Math.round(elapsed / msPerDay) + 'd ago';
    };

    if (isLoading && events.length === 0) {
        return (
            <div className="flex h-[80vh] items-center justify-center text-zinc-400 p-10">
                <div className="w-8 h-8 mr-2 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                Loading dashboard...
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
                        Platform Overview
                    </h1>
                    <p className="text-zinc-400 mt-2 font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Live metrics, failure rates, and system errors
                        {lastRefreshed && (
                            <span className="text-zinc-600 text-xs font-normal">
                                · Updated {lastRefreshed.toLocaleTimeString()}
                            </span>
                        )}
                    </p>
                </div>
                <button
                    onClick={() => loadData(true)}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-white/10 hover:border-white/15 text-zinc-300 hover:text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                    {isRefreshing
                        ? <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        : <RefreshCw className="w-4 h-4" />
                    }
                    {isRefreshing ? 'Refreshing…' : 'Refresh Stats'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-emerald-400/80 uppercase tracking-wider">Total Users</p>
                            <p className="text-3xl font-black text-emerald-300">{totalUsers.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-indigo-500/10 border-indigo-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                            <Briefcase className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-indigo-400/80 uppercase tracking-wider">Employers</p>
                            <p className="text-3xl font-black text-indigo-300">{totalEmployers.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-amber-500/10 border-amber-500/20">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-amber-400/80 uppercase tracking-wider">Admins</p>
                            <p className="text-3xl font-black text-amber-300">{totalAdmins.toLocaleString()}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {isCronStale && (
                <Card className="p-4 bg-orange-900/20 border-orange-500/50 flex flex-col md:flex-row items-start md:items-center gap-3">
                    <AlertTriangle className="text-orange-400 w-5 h-5 flex-shrink-0" />
                    <span className="text-orange-200 font-medium">
                        ⚠ Nightly batch hasn't run in over 24 hours. Last run: {new Date(lastCronRun).toLocaleString()}
                    </span>
                </Card>
            )}

            <div className="rounded-2xl overflow-hidden p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-indigo-400" />
                    System Events — Last 7 Days
                </h3>
                {chartData.length === 0 ? (
                    <div className="h-[250px] flex flex-col items-center justify-center text-zinc-600 gap-2">
                        <Activity className="w-8 h-8 opacity-30" />
                        <p className="text-sm font-medium">No system events in the last 7 days</p>
                        <p className="text-xs">Events appear here as errors, rate limits, and cron runs are logged</p>
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} tickMargin={10} />
                                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'var(--surface-2)',
                                        border: '1px solid var(--surface-edge)',
                                        borderRadius: '12px',
                                        color: '#e4e4e7',
                                        fontSize: '12px',
                                    }}
                                    cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                {chartKeys.map(key => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={typeColors[key] || '#94a3b8'} maxBarSize={50} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="rounded-2xl overflow-hidden p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2">
                        <ServerCrash className="w-5 h-5 text-amber-500" />
                        Provider Rate Limits (Last 24h)
                    </h3>
                    {rateLimitedModels.length === 0 ? (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl flex items-center gap-2 text-sm font-medium">
                            <CheckCircle2 className="w-4 h-4" /> No rate limit events in last 24h ✅
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border-[var(--surface-edge)]" style={{ border: '1px solid var(--surface-edge)' }}>
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-600 border-b border-[var(--surface-edge)]" style={{ background: 'var(--surface-2)' }}>
                                    <tr>
                                        <th className="py-3 px-4">Model ID</th>
                                        <th className="py-3 px-4">Hits/24h</th>
                                        <th className="py-3 px-4">Last Hit</th>
                                        <th className="py-3 px-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--surface-edge)]">
                                    {rateLimitedModels.map(m => (
                                        <tr key={m.modelId} className={`transition-colors hover:bg-zinc-800/30 ${m.rateLimitHits24h > 10 ? 'bg-amber-900/10' : ''}`}>
                                            <td className="py-3 px-4 font-mono text-xs text-indigo-400 truncate max-w-[150px]">{m.modelId}</td>
                                            <td className="py-3 px-4 text-amber-400 font-bold">{m.rateLimitHits24h}</td>
                                            <td className="py-3 px-4 text-zinc-400 text-xs">{getRelativeTime(m.lastRateLimitHit)}</td>
                                            <td className="py-3 px-4 text-right">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold
                                                    ${m.status === 'active'
                                                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                                                        : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                    {m.status === 'active' ? 'Healthy' : m.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl overflow-hidden p-6 flex flex-col max-h-[400px]" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <h3 className="text-lg font-bold text-zinc-200 mb-4 flex items-center gap-2 shrink-0">
                        <Database className="w-5 h-5 text-red-400" />
                        Database Errors (Last 20)
                    </h3>
                    {dbErrors.length === 0 ? (
                        <div className="text-zinc-500 text-sm mt-4">No recent database errors.</div>
                    ) : (
                        <div className="overflow-y-auto pr-2 space-y-2 flex-1 custom-scrollbar">
                            {dbErrors.map(err => {
                                const isExpanded = expandedDbErrors[err.id];
                                const msg = err.error_message || 'Unknown error';
                                const truncatedMsg = msg.length > 80 ? msg.substring(0, 80) + '...' : msg;

                                return (
                                    <div
                                        key={err.id}
                                        onClick={() => toggleDbError(err.id)}
                                        className="bg-black/20 border border-[var(--surface-edge)] rounded-xl p-3 cursor-pointer hover:border-red-500/30 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-400 rounded-sm">
                                                {err.error_code || 'DB_ERR'}
                                            </Badge>
                                            <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                                                <Clock className="w-3 h-3" />
                                                {new Date(err.created_at).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="font-mono text-xs text-zinc-300 mt-2 break-all">
                                            {isExpanded ? msg : truncatedMsg}
                                        </div>
                                        {isExpanded && err.metadata && (
                                            <pre className="mt-3 p-2 bg-black/40 rounded text-[10px] text-zinc-400 overflow-x-auto font-mono border border-[var(--surface-edge)]">
                                                {JSON.stringify(err.metadata, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl overflow-hidden p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <div className="flex justify-between items-start mb-4 gap-4">
                        <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-400" />
                            User Activity Bans (Rate Limit)
                        </h3>
                    </div>

                    {userRateLimits.length === 0 ? (
                        <div className="text-zinc-500 text-sm mt-4">No user rate limits hit recently.</div>
                    ) : (
                        <div className="flex flex-col lg:flex-row gap-6">
                            <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                                <div className="rounded-xl overflow-hidden border border-[var(--surface-edge)]">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-600 border-b border-[var(--surface-edge)]" style={{ background: 'var(--surface-2)' }}>
                                            <tr>
                                                <th className="py-3 px-4">User UUID</th>
                                                <th className="py-3 px-4">Time</th>
                                                <th className="py-3 px-4 text-right">Attempt #</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--surface-edge)] bg-black/10">
                                            {userRateLimits.map(e => (
                                                <tr key={e.id} className="hover:bg-zinc-800/30">
                                                    <td className="py-3 px-4 font-mono text-[10px] text-zinc-400 truncate max-w-[100px]" title={e.user_id || ''}>
                                                        {e.user_id?.split('-')[0]}...
                                                    </td>
                                                    <td className="py-3 px-4 text-xs text-zinc-300">{getRelativeTime(e.created_at)}</td>
                                                    <td className="py-3 px-4 text-xs text-right text-amber-400 font-bold">
                                                        {e.metadata?.attemptCount || '?'} / {e.metadata?.dailyLimit || '?'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="w-full lg:w-48 h-[150px] lg:h-auto shrink-0 self-center">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2 text-center">Hits by hour</p>
                                <div className="h-full min-h-[120px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={userRateLimitsByHour}>
                                            <XAxis dataKey="hour" tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} />
                                            <Tooltip
                                                contentStyle={{
                                                    background: 'var(--surface-2)',
                                                    border: '1px solid var(--surface-edge)',
                                                    borderRadius: '8px',
                                                    color: '#e4e4e7',
                                                    fontSize: '10px',
                                                }}
                                                cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                                            />
                                            <Bar dataKey="count" fill={COLORS.chart[0]} radius={[2, 2, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl overflow-hidden p-6" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <h3 className="text-lg font-bold text-zinc-200 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-400" />
                            Nightly Batch Status
                        </h3>
                        <div className="flex items-center gap-2">
                            {cronTriggerStatus === 'dispatched' && (
                                <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Dispatched
                                </span>
                            )}
                            <button
                                onClick={handleTriggerCron}
                                disabled={isTriggeringCron}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isTriggeringCron
                                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                    : <Play className="w-3.5 h-3.5" />
                                }
                                {isTriggeringCron ? 'Dispatching…' : 'Trigger Now'}
                            </button>
                        </div>
                    </div>
                    <p className="text-xs text-zinc-500 mb-4">
                        Auto-refreshes every 30s. Batch runs on GitHub Actions (~10–20 min) and logs here when complete.
                    </p>
                    {cronEvents.length === 0 ? (
                        <div className="text-zinc-500 text-sm">No recent cron runs logged.</div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border-[var(--surface-edge)]" style={{ border: '1px solid var(--surface-edge)' }}>
                            <table className="w-full text-sm text-left shadow-sm">
                                <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-600 border-b border-[var(--surface-edge)]" style={{ background: 'var(--surface-2)' }}>
                                    <tr>
                                        <th className="py-3 px-4">Timestamp</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Duration</th>
                                        <th className="py-3 px-4 text-right">Steps</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--surface-edge)]">
                                    {resolvedCronRows.map(row => (
                                        <tr key={row.triggered.id} className="hover:bg-zinc-800/30 transition-colors">
                                            <td className="py-3 px-4 text-xs text-zinc-300">
                                                {new Date(row.triggered.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-3 px-4">
                                                {row.resolvedStatus === 'cron_completed' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                                        <CheckCircle2 className="w-3 h-3" /> OK
                                                    </span>
                                                ) : row.resolvedStatus === 'cron_running' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25 animate-pulse">
                                                        <Loader2 className="w-3 h-3 animate-spin" /> Running
                                                    </span>
                                                ) : row.resolvedStatus === 'cron_failed' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                                                        <XCircle className="w-3 h-3" /> Failed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
                                                        <Zap className="w-3 h-3" /> Dispatched
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-xs text-zinc-400">
                                                {row.resolvedMetadata?.duration_ms ? `${(row.resolvedMetadata.duration_ms / 1000).toFixed(1)}s` : '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right text-zinc-300 text-xs truncate max-w-[120px]" title={JSON.stringify(row.resolvedMetadata?.completedSteps || [])}>
                                                {Array.isArray(row.resolvedMetadata?.completedSteps)
                                                    ? row.resolvedMetadata.completedSteps.join(', ')
                                                    : (row.resolvedMetadata?.message || '—')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
