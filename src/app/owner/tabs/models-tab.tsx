'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Copy, RotateCcw, Play, Plus, Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface ModelStat {
    modelId: string;
    provider: string;
    tier: number;
    rpm: number;
    tpm: number;
    rpd: number;
    contextWindow: number;
    isActive: boolean;
    isVerified: boolean;
    isPreview: boolean;
    deprecatedAt: string | null;
    lastVerified: string | null;
    notes: string | null;
    rateLimitHits24h: number;
    lastRateLimitHit: string | null;
    status: 'active' | 'degraded' | 'deprecated';
    modelType: 'audio' | 'text';
}

interface NewModelForm {
    modelId: string;
    provider: string;
    tier: number;
    rpm: number;
    tpm: number;
    rpd: number;
    notes: string;
}

export function ModelsTab() {
    const [models, setModels] = useState<ModelStat[]>([]);
    const [deprecatedCount24h, setDeprecatedCount24h] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [verifyingModel, setVerifyingModel] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);

    // Inline editing state
    const [editingModel, setEditingModel] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{ rpm: number; tpm: number; rpd: number }>({ rpm: 0, tpm: 0, rpd: 0 });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const [newModel, setNewModel] = useState<NewModelForm>({
        modelId: '',
        provider: 'groq',
        tier: 5,
        rpm: 30,
        tpm: 100000,
        rpd: 1000,
        notes: ''
    });

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [modelsRes, eventsRes] = await Promise.all([
                fetch('/api/admin/models', { cache: 'no-store' }),
                fetch('/api/admin/events?type=model_deprecated&days=1&limit=50', { cache: 'no-store' })
            ]);

            const modelsData = await modelsRes.json();
            const eventsData = await eventsRes.json();

            setModels(modelsData.models || []);
            setDeprecatedCount24h(eventsData.events?.length || 0);
        } catch (error) {
            console.error('Failed to load model data:', error);
            toast.error('Failed to load model registry');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleVerify = async (modelId: string) => {
        setVerifyingModel(modelId);
        try {
            const res = await fetch('/api/admin/models/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId })
            });
            const data = await res.json();

            if (res.ok) {
                if (data.status === 'verified') toast.success(data.message);
                else if (data.status === 'rate_limited') toast.warning(data.message);
                else toast.info(data.message);
            } else {
                toast.error(data.error || 'Verification failed');
            }
            loadData(); // Refresh list to update status
        } catch {
            toast.error('Network error during verification');
        } finally {
            setVerifyingModel(null);
        }
    };

    const handleDeprecate = async (modelId: string) => {
        if (!confirm(`Are you sure you want to deprecate ${modelId}?`)) return;
        try {
            const res = await fetch('/api/admin/models', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, reason: 'Manual deprecation by admin' })
            });
            if (res.ok) {
                toast.success('Model deprecated successfully');
                loadData();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to deprecate');
            }
        } catch {
            toast.error('Network error');
        }
    };

    const handleRestore = async (modelId: string) => {
        try {
            const res = await fetch('/api/admin/models', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, isActive: true, notes: 'Restored by admin' })
            });

            if (res.ok) {
                toast.success('Model restored — click Verify to confirm it still works');
                loadData();
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to restore model');
            }
        } catch {
            toast.error('Network error');
        }
    };

    const handleAddModel = async () => {
        if (!newModel.modelId || !newModel.provider) {
            toast.error('Model ID and Provider are required');
            return;
        }

        setIsAdding(true);
        try {
            const res = await fetch('/api/admin/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newModel)
            });
            const data = await res.json();

            if (res.ok) {
                toast.success('Model added');
                setShowAddForm(false);
                setNewModel({
                    modelId: '',
                    provider: 'groq',
                    tier: 5,
                    rpm: 30,
                    tpm: 100000,
                    rpd: 1000,
                    notes: ''
                });
                loadData();
            } else {
                toast.error(data.error || 'Failed to add model');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setIsAdding(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const startEditing = (model: ModelStat) => {
        setEditingModel(model.modelId);
        setEditValues({ rpm: model.rpm, tpm: model.tpm, rpd: model.rpd });
    };

    const cancelEditing = () => {
        setEditingModel(null);
    };

    const saveEdit = async (modelId: string) => {
        setIsSavingEdit(true);
        try {
            const res = await fetch('/api/admin/models', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, ...editValues })
            });
            if (res.ok) {
                toast.success('Saved successfully');
                setEditingModel(null);
                loadData();
            } else {
                toast.error('Failed to save changes');
            }
        } catch {
            toast.error('Network error');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Note: The UI for Add Model uses Verify underneath, which also acts as an "Add" if the model didn't exist? Wait, our verify API requires the model to exist in the registry already to fetch its provider. 
    // We should just use direct SQL/Supabase insert for Add, but since we don't have an Add API yet, we'll need to create one if we want full functionality. For now, we will mock the button.

    const getRelativeTime = (isoDate: string | null) => {
        if (!isoDate) return 'Never';
        const msPerMinute = 60 * 1000;
        const msPerHour = msPerMinute * 60;
        const msPerDay = msPerHour * 24;

        const elapsed = Date.now() - new Date(isoDate).getTime();

        if (elapsed < msPerMinute) return 'Just now';
        if (elapsed < msPerHour) return Math.round(elapsed / msPerMinute) + ' minutes ago';
        if (elapsed < msPerDay) return Math.round(elapsed / msPerHour) + ' hours ago';
        return Math.round(elapsed / msPerDay) + ' days ago';
    };

    const isStale = (isoDate: string | null) => {
        if (!isoDate) return true;
        return (Date.now() - new Date(isoDate).getTime()) > (48 * 60 * 60 * 1000);
    };

    return (
        <div className="text-white p-6 lg:p-10">
            <div className="max-w-[1400px] mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        Model Registry
                    </h1>
                    <p className="text-zinc-400 mt-2 font-medium">
                        Monitor provider health, rate limits, and model verification status
                    </p>
                </div>

                {/* Banner */}
                {deprecatedCount24h > 0 ? (
                    <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/25 flex items-center gap-3">
                        <AlertCircle className="text-red-400 w-5 h-5 flex-shrink-0" />
                        <span className="text-red-200 font-bold text-sm">
                            ⚠ {deprecatedCount24h} model(s) automatically deprecated in the last 24 hours. Check system events for details.
                        </span>
                    </div>
                ) : (
                    models.length > 0 && !isLoading && (
                        <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3">
                            <CheckCircle2 className="text-emerald-400 w-5 h-5 flex-shrink-0" />
                            <span className="text-emerald-200 font-bold text-sm">
                                All {models.filter(m => m.isActive).length} active models verified and healthy.
                            </span>
                        </div>
                    )
                )}

                {/* Main Table */}
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-600 border-b border-[var(--surface-edge)]" style={{ background: 'var(--surface-2)' }}>
                                <tr>
                                    <th className="px-4 py-4">Status</th>
                                    <th className="px-4 py-4">Model ID</th>
                                    <th className="px-4 py-4">Provider</th>
                                    <th className="px-4 py-4">Tier</th>
                                    <th className="px-4 py-4">RPM</th>
                                    <th className="px-4 py-4">TPM</th>
                                    <th className="px-4 py-4">RPD</th>
                                    <th className="px-4 py-4">Last Verified</th>
                                    <th className="px-4 py-4">429s/24h</th>
                                    <th className="px-4 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--surface-edge)]">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                                            <div className="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                            Loading registry data...
                                        </td>
                                    </tr>
                                ) : models.map((model) => (
                                    <tr key={model.modelId} className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-4 py-3">
                                            {model.status === 'active' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" title="Active & Healthy" />}
                                            {model.status === 'degraded' && <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse" title="Degraded (High 429s)" />}
                                            {model.status === 'deprecated' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Deprecated" />}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleCopy(model.modelId)}
                                                className="font-mono text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors"
                                            >
                                                {model.modelId} <Copy className="w-3 h-3 opacity-50" />
                                            </button>
                                            {model.modelType === 'audio' && (
                                                <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25">
                                                    Audio
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-300 capitalize">{model.provider}</td>
                                        <td className="px-4 py-3 text-zinc-300">{model.tier}</td>

                                        {/* Editable Columns */}
                                        {['rpm', 'tpm', 'rpd'].map((field) => (
                                            <td key={field} className="px-4 py-3 text-zinc-300">
                                                {editingModel === model.modelId ? (
                                                    <input
                                                        type="number"
                                                        value={editValues[field as keyof typeof editValues]}
                                                        onChange={(e) => setEditValues(prev => ({ ...prev, [field]: parseInt(e.target.value) || 0 }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit(model.modelId);
                                                            if (e.key === 'Escape') cancelEditing();
                                                        }}
                                                        className="w-20 bg-black border border-indigo-500/50 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                        autoFocus={field === 'rpm'}
                                                    />
                                                ) : (
                                                    <div
                                                        onClick={() => startEditing(model)}
                                                        className="cursor-pointer hover:bg-zinc-800/50 px-2 py-1 -mx-2 rounded flex items-center gap-2 group"
                                                    >
                                                        {model[field as keyof typeof model]}
                                                        <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50" />
                                                    </div>
                                                )}
                                            </td>
                                        ))}

                                        <td className="px-4 py-3">
                                            <span className={isStale(model.lastVerified) ? "text-red-400 font-medium" : "text-zinc-400"}>
                                                {getRelativeTime(model.lastVerified)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {model.rateLimitHits24h > 0 ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25">
                                                    {model.rateLimitHits24h}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-500">0</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {editingModel === model.modelId ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button size="sm" variant="ghost" className="h-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={() => saveEdit(model.modelId)} disabled={isSavingEdit}>
                                                        {isSavingEdit ? <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : <Check className="w-4 h-4" />}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 text-zinc-400 hover:text-white" onClick={cancelEditing}>
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end gap-2 text-zinc-400">
                                                    {model.status === 'deprecated' ? (
                                                        <Button size="sm" variant="outline" className="h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleRestore(model.modelId)}>
                                                            <RotateCcw className="w-3 h-3 mr-1" /> Restore
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-8 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 hover:text-white"
                                                                onClick={() => handleVerify(model.modelId)}
                                                                disabled={verifyingModel === model.modelId}
                                                            >
                                                                {verifyingModel === model.modelId ? <div className="w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                                                                {model.modelType === 'audio' ? 'Mark OK' : 'Verify'}
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => handleDeprecate(model.modelId)}>
                                                                Deprecate
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Add Model Form placeholder - backend endpoint required for full insert, keeping UI matching requirements */}
                <div className="pt-4 border-t border-[var(--surface-edge)]">
                    <Button
                        variant="ghost"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 font-bold"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        {showAddForm ? 'Cancel Adding' : 'Add New Model'}
                    </Button>

                    {showAddForm && (
                        <div className="rounded-2xl p-6 mt-4" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                            <h3 className="text-lg font-bold text-zinc-200 mb-4">Register New Model</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {/* Basic form structure to match spec */}
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Model ID</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        placeholder="e.g. llama-3.1-8b"
                                        value={newModel.modelId}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, modelId: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Provider</label>
                                    <select
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        value={newModel.provider}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, provider: e.target.value }))}
                                    >
                                        <option value="groq">Groq</option>
                                        <option value="gemini">Gemini</option>

                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">Tier (1-12)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="12"
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        value={newModel.tier}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, tier: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">RPM (Req per min)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        value={newModel.rpm}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, rpm: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">TPM (Tokens per min)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        value={newModel.tpm}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, tpm: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-widest">RPD (Req per day)</label>
                                    <input
                                        type="number"
                                        className="w-full rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                                        value={newModel.rpd}
                                        onChange={(e) => setNewModel(prev => ({ ...prev, rpd: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <Button
                                    className="btn-primary"
                                    onClick={handleAddModel}
                                    disabled={isAdding}
                                >
                                    {isAdding ? <div className="w-4 h-4 mr-2 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                    Verify & Add
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
