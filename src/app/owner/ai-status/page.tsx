import { createServiceRoleSupabase } from '@/lib/supabase/server';
import { getAIClient } from '@/lib/ai/client';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default async function AIStatusPage() {
    const supabase = await createServiceRoleSupabase();
    
    // Fetch model registry data
    const { data: models } = await supabase
        .from('model_registry')
        .select('model_id, provider, tier, is_active, is_verified, deprecated_at, notes, last_verified')
        .order('is_active', { ascending: false })
        .order('tier', { ascending: true });

    let rateLimiterUsage: Record<string, any> = {};
    try {
        const client = getAIClient();
        const status = await client.getRateLimiterStatus();
        rateLimiterUsage = (status.usage as Record<string, any>) ?? {};
    } catch {
        // Ignore enrichment failures
    }

    const modelList = (models ?? []).map((model) => ({
        id: model.model_id,
        provider: model.provider,
        tier: model.tier,
        is_active: model.is_active,
        is_verified: model.is_verified,
        deprecated_at: model.deprecated_at,
        notes: model.notes,
        last_verified: model.last_verified,
        rateLimiterData: rateLimiterUsage[model.model_id] ?? null,
    }));

    if (modelList.length === 0) {
        return (
            <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
                <h1 className="text-3xl font-black text-white">AI Model Status</h1>
                <div className="text-sm text-zinc-500 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
                    No models found in the registry. Add models via the <strong className="text-zinc-300">Models</strong> tab.
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-6">
            <h1 className="text-3xl font-black text-white">AI Model Status</h1>
            <p className="text-zinc-400">View real-time status and rate limiter statistics for all registered AI models.</p>

            <div className="grid gap-3">
                {modelList.map(m => (
                    <Card key={m.id} className="flex items-center justify-between p-5 bg-[var(--surface-1)]/50 border-[var(--surface-edge)]/50 hover:bg-[var(--surface-1)] transition-colors">
                        <div className="flex items-center gap-4">
                            {m.is_active && !m.deprecated_at
                                ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                                : m.deprecated_at
                                    ? <XCircle className="w-5 h-5 text-red-500" />
                                    : <AlertTriangle className="w-5 h-5 text-amber-500" />
                            }
                            <div>
                                <div className="text-base font-bold font-mono text-white flex items-center gap-2">
                                    {m.id}
                                    {m.is_verified && (
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Verified" />
                                    )}
                                </div>
                                <div className="text-sm text-zinc-500 mt-1">
                                    <span className="capitalize">{m.provider}</span> · Tier {m.tier}
                                    {m.last_verified && (
                                        <span className="ml-2 text-zinc-600">
                                            · Verified {new Date(m.last_verified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                                {m.notes && (
                                    <div className="text-xs text-zinc-600 mt-1">{m.notes}</div>
                                )}
                            </div>
                        </div>
                        <div className="text-sm font-medium">
                            {m.deprecated_at
                                ? <span className="text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">Deprecated</span>
                                : m.is_active
                                    ? <span className="text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">Active</span>
                                    : <span className="text-zinc-500 bg-zinc-500/10 px-3 py-1 rounded-full border border-zinc-500/20">Inactive</span>
                            }
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
