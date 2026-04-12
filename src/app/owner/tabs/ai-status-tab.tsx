'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ModelStatus {
    id: string;
    provider: string;
    is_active: boolean;
    tier: number;
    deprecated_at: string | null;
    is_verified: boolean;
    notes: string | null;
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
                <div className="text-sm text-zinc-500 p-4 bg-zinc-900/30 rounded-lg border border-zinc-800">
                    No active models found in the registry. Add models via the <strong className="text-zinc-300">Models</strong> tab.
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
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="text-sm font-mono text-white">{m.id}</div>
                                    {m.is_verified && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                                            <CheckCircle className="w-3 h-3" />
                                            Verified
                                        </span>
                                    )}
                                </div>
                                {m.notes && <div className="text-xs text-zinc-500 mt-1">{m.notes}</div>}
                                <div className="text-xs text-zinc-500">{m.provider} · Tier {m.tier}</div>
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
