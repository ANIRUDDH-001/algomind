// @ts-nocheck
// 
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
//  -- automated unused local suppression
import { DollarSign, TrendingUp, AlertTriangle, RefreshCw, Cloud, Mic, HardDrive, Brain, Loader2, ShieldAlert } from 'lucide-react';

const SERVICE_META: Record<string, any> = {
    polly: { icon: Mic, label: 'Amazon Polly (TTS)', color: 'text-blue-400' },
    s3: { icon: HardDrive, label: 'Amazon S3 (Storage)', color: 'text-green-400' },
    transcribe: { icon: Mic, label: 'Amazon Transcribe (STT)', color: 'text-purple-400' },
    bedrock: { icon: Brain, label: 'Amazon Bedrock (AI)', color: 'text-amber-400' },
};

function formatCost(usd: number): string {
    if (usd < 0.001) return '< $0.001';
    if (usd < 1) return `$${usd.toFixed(4)}`;
    return `$${usd.toFixed(2)}`;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AWSUsagePanel({ budgetLimit }: { budgetLimit: number }) {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(30);

    const fetchUsage = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/owner/aws-usage?days=${days}`, {
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            // Inject dynamic budgetLimit into data for rendering logic
            json.budgetLimit = budgetLimit;
            json.budgetUsedPercent = (json.totalCost / budgetLimit) * 100;
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load');
        } finally {
            setLoading(false);
        }
    }, [days, budgetLimit]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    if (loading && !data) {
        return <div className="flex justify-center py-20 text-zinc-400"><Loader2 className="w-6 h-6 animate-spin mr-3" /> Loading AWS usage data...</div>;
    }

    if (error && !data) {
        return (
            <Card className="p-8 text-center border-red-500/30 bg-red-500/5">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-red-300">Failed to load AWS usage</h3>
                <p className="text-zinc-400 mt-2 text-sm">{error}</p>
                <Button onClick={fetchUsage} variant="outline" className="mt-4"><RefreshCw className="w-4 h-4 mr-2" /> Retry</Button>
            </Card>
        );
    }

    const totalCost = data?.totalCost || 0;
    const budgetPercent = data?.budgetUsedPercent || 0;
    const budgetColor = budgetPercent >= 90 ? 'text-red-400' : budgetPercent >= 70 ? 'text-amber-400' : budgetPercent >= 40 ? 'text-yellow-400' : 'text-emerald-400';
    const budgetBarColor = budgetPercent >= 90 ? 'bg-red-500' : budgetPercent >= 70 ? 'bg-amber-500' : budgetPercent >= 40 ? 'bg-yellow-500' : 'bg-emerald-500';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-zinc-200 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-amber-400" /> AWS Budget Tracker
                    </h2>
                    <p className="text-zinc-500 text-sm mt-1">Configured Budget limit: ${budgetLimit}</p>
                </div>
                <div className="flex gap-2">
                    <select value={days} onChange={e => setDays(Number(e.target.value))} className="bg-zinc-800 border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 text-sm">
                        <option value={7}>7 days</option>
                        <option value={14}>14 days</option>
                        <option value={30}>30 days</option>
                    </select>
                    <Button onClick={fetchUsage} variant="outline" size="sm" disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Card className="p-6 bg-[var(--surface-1)] border-[var(--surface-edge)]">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <span className={`text-3xl font-black ${budgetColor}`}>{formatCost(totalCost)}</span>
                        <span className="text-zinc-500 text-lg ml-2">/ ${budgetLimit}</span>
                    </div>
                    {budgetPercent >= 80 && (
                        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Budget Warning</Badge>
                    )}
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${budgetBarColor}`} style={{ width: `${Math.min(budgetPercent, 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-xs text-zinc-500">
                    <span>{budgetPercent.toFixed(2)}% used</span>
                    <span>${Math.max(0, budgetLimit - totalCost).toFixed(2)} remaining</span>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(SERVICE_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    const svc = data?.summary?.find((s: any) => s.service === key);
                    return (
                        <Card key={key} className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)]">
                            <div className="flex items-center gap-3 mb-3">
                                <Icon className={`w-5 h-5 ${meta.color}`} />
                                <h3 className="font-bold text-zinc-300">{meta.label}</h3>
                            </div>
                            {svc ? (
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div><div className="text-lg font-bold text-zinc-200">{svc.total_calls.toLocaleString()}</div><div className="text-xs text-zinc-500">API Calls</div></div>
                                    <div><div className="text-lg font-bold text-zinc-200">{formatBytes(svc.total_bytes)}</div><div className="text-xs text-zinc-500">Data</div></div>
                                    <div><div className={`text-lg font-bold ${meta.color}`}>{formatCost(Number(svc.total_estimated_cost))}</div><div className="text-xs text-zinc-500">Cost</div></div>
                                </div>
                            ) : <p className="text-zinc-600 text-sm">No usage recorded</p>}
                        </Card>
                    );
                })}
            </div>

            {data?.warning && (
                <div className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {data.warning}
                </div>
            )}

            <Card className="p-5 bg-[var(--surface-1)] border-[var(--surface-edge)]">
                <h3 className="font-bold text-zinc-300 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-zinc-500" /> Recent API Calls</h3>
                {data?.recentLogs && data.recentLogs.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead><tr className="text-zinc-500 text-xs uppercase border-b border-zinc-800"><th className="text-left py-2 px-2">Service</th><th className="text-left py-2 px-2">Operation</th><th className="text-right py-2 px-2">Cost</th><th className="text-right py-2 px-2">Time</th></tr></thead>
                            <tbody>
                                {data.recentLogs.slice(0, 20).map((log: any) => (
                                    <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                        <td className={`py-2 px-2 font-medium ${SERVICE_META[log.service]?.color || 'text-zinc-400'}`}>{log.service}</td>
                                        <td className="py-2 px-2 text-zinc-400">{log.operation}</td>
                                        <td className="py-2 px-2 text-right text-zinc-300">{formatCost(Number(log.estimated_cost_usd))}</td>
                                        <td className="py-2 px-2 text-right text-zinc-500">{new Date(log.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : <p className="text-zinc-600 text-sm text-center py-6">No AWS API calls recorded yet.</p>}
            </Card>
        </div>
    );
}
