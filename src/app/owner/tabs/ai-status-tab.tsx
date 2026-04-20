'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ModelStatus {
    id: string;
    provider: string;
    tier: number;
    is_active: boolean;
    is_verified: boolean;
    deprecated_at: string | null;
    notes: string | null;
    last_verified: string | null;
    rateLimiterData: unknown | null;
}

export function AIStatusTab() {
    const [models, setModels] = useState<ModelStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/ai-status')
            .then(r => r.json())
            .then(data => {
                setModels(data.models || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-zinc-400 p-4">Loading model status...</div>;

    if (!loading && models.length === 0) {
        return (
            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">AI Model Status</h2>
                <div className="text-sm text-zinc-500 p-4 rounded-lg border border-zinc-800 bg-zinc-900/30">
                    No models found in the registry. Add models via the <strong className="text-zinc-300">Models</strong> tab.
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">AI Model Status</h2>
            <div className="grid gap-2">
                {models.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-[var(--surface-1)] rounded-lg border border-white/8">
                        <div className="flex items-center gap-3">
                            {m.is_active && !m.deprecated_at
                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                : m.deprecated_at
                                    ? <XCircle className="w-4 h-4 text-red-500" />
                                    : <AlertTriangle className="w-4 h-4 text-amber-500" />
                            }
                            <div>
                                <div className="text-sm font-mono text-white flex items-center gap-2">
                                    {m.id}
                                    {m.is_verified && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" title="Verified" />
                                    )}
                                </div>
                                <div className="text-xs text-zinc-500">
                                    {m.provider} · Tier {m.tier}
                                    {m.last_verified && (
                                        <span className="ml-2 text-zinc-600">
                                            · Verified {new Date(m.last_verified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </div>
                                {m.notes && (
                                    <div className="text-xs text-zinc-600 mt-0.5">{m.notes}</div>
                                )}
                            </div>
                        </div>
                        <div className="text-xs">
                            {m.deprecated_at
                                ? <span className="text-red-400">Deprecated</span>
                                : m.is_active
                                    ? <span className="text-green-400">Active</span>
                                    : <span className="text-zinc-500">Inactive</span>
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
