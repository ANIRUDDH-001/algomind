'use client';
import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface ModelStatus {
    id: string;
    provider: string;
    is_active: boolean;
    tier: number;
    deprecated_at: string | null;
    last_error?: string;
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

    if (loading) return <div className="text-slate-400 p-4">Loading model status...</div>;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">AI Model Status</h2>
            <div className="grid gap-2">
                {models.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-3">
                            {m.is_active && !m.deprecated_at
                                ? <CheckCircle className="w-4 h-4 text-green-500" />
                                : m.deprecated_at
                                    ? <XCircle className="w-4 h-4 text-red-500" />
                                    : <AlertTriangle className="w-4 h-4 text-amber-500" />
                            }
                            <div>
                                <div className="text-sm font-mono text-white">{m.id}</div>
                                <div className="text-xs text-slate-500">{m.provider} · Tier {m.tier}</div>
                            </div>
                        </div>
                        <div className="text-xs">
                            {m.deprecated_at
                                ? <span className="text-red-400">Deprecated</span>
                                : m.is_active
                                    ? <span className="text-green-400">Active</span>
                                    : <span className="text-slate-500">Inactive</span>
                            }
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
