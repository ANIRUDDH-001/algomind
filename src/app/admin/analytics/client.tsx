'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    AlertCircle, AlertTriangle, CheckCircle2, ServerCrash,
    Database, Users, Activity, Loader2, Clock, XCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    Legend, ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';

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
    event_type: string;
    count: number;
}

interface ModelStat {
    modelId: string;
    rateLimitHits24h: number;
    lastRateLimitHit: string | null;
    status: string;
}

export default function AnalyticsAdminClient() {
    const [events, setEvents] = useState<SystemEvent[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsRow[]>([]);
    const [models, setModels] = useState<ModelStat[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
    const [expandedDbErrors, setExpandedDbErrors] = useState<Record<string, boolean>>({});

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
            setModels(modelsData.models || []);
            setLastRefreshed(new Date());
            if (manual) toast.success('Analytics refreshed');
        } catch (error) {
            console.error('Failed to load analytics data:', error);
            toast.error('Failed to load system analytics');
        } finally {
            setIsLoading(false);
            if (manual) setIsRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(() => loadData(), 30000);
        return () => clearInterval(interval);
    }, []);

    const toggleDbError = (id: string) => {
        setExpandedDbErrors(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // Panel 1: Transform Analytics for Chart (Stacked Bar)
    const chartData = (Array.isArray(analytics) ? analytics : []).reduce((acc, curr) => {
        const dateString = curr.event_date;
        let dayData = acc.find((d: any) => d.name === dateString);
        if (!dayData) {
            dayData = { name: dateString };
            acc.push(dayData);
        }
        dayData[curr.event_type] = curr.count;
        return acc;
    }, [] as any[]).sort((a: any, b: any) => new Date(a.name).getTime() - new Date(b.name).getTime());

    const typeColors: Record<string, string> = {
        'model_429': '#f59e0b', // amber
        'model_deprecated': '#ef4444', // red
        'db_error': '#7f1d1d', // red-dark
        'user_rate_limit': '#3b82f6', // blue
        'leetcode_fetch_failed': '#a855f7', // purple
        'piston_error': '#f97316', // orange
        'embedding_failed': '#ec4899', // pink
        'cron_completed': '#10b981', // emerald
        'cron_failed': '#dc2626' // red
    };

    // Collect all unique event types from the chart data to build Bars
    const chartKeys = Array.from(new Set((Array.isArray(analytics) ? analytics : []).map(a => a.event_type)));

    // Panel 2: Model Rate Limits (last 24h)
    const rateLimitedModels = (Array.isArray(models) ? models : [])
        .filter(m => m.rateLimitHits24h > 0)
        .sort((a, b) => b.rateLimitHits24h - a.rateLimitHits24h);

    // Panel 3: DB Errors
    const dbErrors = (Array.isArray(events) ? events : []).filter(e => e.type === 'db_error').slice(0, 20);

    // Panel 4: User Rate Limits
    const userRateLimits = (Array.isArray(events) ? events : []).filter(e => e.type === 'user_rate_limit');

    // Derived chart for user rate limits (by hour)
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

    // Panel 5: Cron Health
    const cronEvents = events.filter(e => e.type === 'cron_completed' || e.type === 'cron_failed').slice(0, 10);

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
            <div className="flex h-full items-center justify-center text-slate-400 p-10">
                <Loader2 className="w-8 h-8 animate-spin mr-2" />
                Loading analytics...
            </div>
        );
    }

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-[1400px] mx-auto space-y-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            System Analytics
                        </h1>
                        <p className="text-slate-400 mt-2 font-medium flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Live failure rates and error feeds
                            {lastRefreshed && (
                                <span className="text-slate-600 text-xs font-normal">
                                    · Updated {lastRefreshed.toLocaleTimeString()}
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing…' : 'Refresh Stats'}
                    </button>
                </div>

                {isCronStale && (
                    <Card className="p-4 bg-orange-900/20 border-orange-500/50 flex flex-col md:flex-row items-start md:items-center gap-3">
                        <AlertTriangle className="text-orange-400 w-5 h-5 flex-shrink-0" />
                        <span className="text-orange-200 font-medium">
                            ⚠ Nightly batch hasn't run in over 24 hours. Last run: {new Date(lastCronRun).toLocaleString()}
                        </span>
                    </Card>
                )}

                {/* Panel 1: Error Volume Chart */}
                <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                    <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-400" />
                        System Events — Last 7 Days
                    </h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                                    itemStyle={{ fontSize: '12px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                {chartKeys.map(key => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={typeColors[key] || '#94a3b8'} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Panel 2: Model Rate Limit Table */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <ServerCrash className="w-5 h-5 text-amber-500" />
                            Provider Rate Limits (Last 24h)
                        </h3>
                        {rateLimitedModels.length === 0 ? (
                            <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center gap-2 text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" /> No rate limit events in last 24h ✅
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="pb-3 pr-4">Model ID</th>
                                            <th className="pb-3 px-4">Hits/24h</th>
                                            <th className="pb-3 px-4">Last Hit</th>
                                            <th className="pb-3 pl-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {rateLimitedModels.map(m => (
                                            <tr key={m.modelId} className={`transition-colors ${m.rateLimitHits24h > 10 ? 'bg-amber-900/10' : ''}`}>
                                                <td className="py-3 pr-4 font-mono text-xs text-blue-400 truncate max-w-[150px]">{m.modelId}</td>
                                                <td className="py-3 px-4 text-amber-400 font-bold">{m.rateLimitHits24h}</td>
                                                <td className="py-3 px-4 text-slate-400 text-xs">{getRelativeTime(m.lastRateLimitHit)}</td>
                                                <td className="py-3 pl-4 text-right">
                                                    <Badge className={m.status === 'degraded' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}>
                                                        {m.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>

                    {/* Panel 3: DB Error Feed */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl flex flex-col max-h-[400px]">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2 shrink-0">
                            <Database className="w-5 h-5 text-red-400" />
                            Database Errors (Last 20)
                        </h3>
                        {dbErrors.length === 0 ? (
                            <div className="text-slate-500 text-sm mt-4">No recent database errors.</div>
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
                                            className="bg-slate-950/50 border border-slate-800/80 rounded p-3 cursor-pointer hover:border-red-500/30 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <Badge variant="outline" className="text-[10px] border-red-500/20 text-red-400 rounded-sm">
                                                    {err.error_code || 'DB_ERR'}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(err.created_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <div className="font-mono text-xs text-slate-300 mt-2 break-all">
                                                {isExpanded ? msg : truncatedMsg}
                                            </div>
                                            {isExpanded && err.metadata && (
                                                <pre className="mt-3 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto font-mono border border-slate-800">
                                                    {JSON.stringify(err.metadata, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>

                    {/* Panel 4: User Rate Limit Feed */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                        <div className="flex justify-between items-start mb-4 gap-4">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-400" />
                                User Activity Bans (Rate Limit)
                            </h3>
                        </div>

                        {userRateLimits.length === 0 ? (
                            <div className="text-slate-500 text-sm mt-4">No user rate limits hit recently.</div>
                        ) : (
                            <div className="flex flex-col lg:flex-row gap-6">
                                <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-slate-500 text-[10px] uppercase tracking-wider sticky top-0 bg-slate-900/90 backdrop-blur z-10 pb-2 shadow-[0_4px_10px_-4px_rgba(0,0,0,0.5)]">
                                            <tr>
                                                <th className="pb-2">User UUID</th>
                                                <th className="pb-2">Time</th>
                                                <th className="pb-2 text-right">Attempt #</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/50">
                                            {userRateLimits.map(e => (
                                                <tr key={e.id} className="hover:bg-slate-800/30">
                                                    <td className="py-2.5 font-mono text-[10px] text-slate-400 truncate max-w-[100px]" title={e.user_id || ''}>
                                                        {e.user_id?.split('-')[0]}...
                                                    </td>
                                                    <td className="py-2.5 text-xs text-slate-300">{getRelativeTime(e.created_at)}</td>
                                                    <td className="py-2.5 text-xs text-right text-amber-400 font-bold">
                                                        {e.metadata?.attemptCount || '?'} / {e.metadata?.dailyLimit || '?'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="w-full lg:w-48 h-[150px] lg:h-auto shrink-0 self-center">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">Hits by hour</p>
                                    <div className="h-full min-h-[120px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={userRateLimitsByHour}>
                                                <XAxis dataKey="hour" fontSize={10} stroke="#475569" tickLine={false} axisLine={false} />
                                                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '4px', fontSize: '10px' }} cursor={{ fill: '#1e293b' }} />
                                                <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>

                    {/* Panel 5: Cron Health */}
                    <Card className="p-6 bg-slate-900/40 border-slate-800/50 backdrop-blur-sm shadow-xl">
                        <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-400" />
                            Nightly Batch Status
                        </h3>
                        {cronEvents.length === 0 ? (
                            <div className="text-slate-500 text-sm mt-4">No recent cron runs logged.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-slate-400 text-[10px] uppercase font-bold tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="pb-3 pr-4">Timestamp</th>
                                            <th className="pb-3 px-4">Status</th>
                                            <th className="pb-3 px-4">Duration</th>
                                            <th className="pb-3 px-4">Users Processed</th>
                                            <th className="pb-3 pl-4 text-right">Steps</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {cronEvents.map(e => (
                                            <tr key={e.id} className="hover:bg-slate-800/20">
                                                <td className="py-2.5 pr-4 text-xs text-slate-300">
                                                    {new Date(e.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {e.type === 'cron_completed' ? (
                                                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1 pl-1">
                                                            <CheckCircle2 className="w-3 h-3" /> OK
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="border-red-500/30 text-red-400 bg-red-500/10 gap-1 pl-1">
                                                            <XCircle className="w-3 h-3" /> Failed
                                                        </Badge>
                                                    )}

                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-xs text-slate-400">
                                                    {e.metadata?.duration_ms ? `${(e.metadata.duration_ms / 1000).toFixed(1)}s` : '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-slate-300">
                                                    {e.metadata?.usersProcessed || e.metadata?.syncedCount || e.metadata?.processedCount || '—'}
                                                </td>
                                                <td className="py-2.5 pl-4 text-right text-slate-300 text-xs truncate max-w-[120px]" title={JSON.stringify(e.metadata?.completedSteps || [])}>
                                                    {Array.isArray(e.metadata?.completedSteps) ? e.metadata.completedSteps.join(', ') : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            </div>


        </div>
    );
}