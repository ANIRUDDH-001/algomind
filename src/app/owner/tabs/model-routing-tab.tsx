'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowUp, ArrowDown, Plus, Trash2, Loader2, Save, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface RoutingEntry {
    id: string;
    model_id: string;
    provider: string;
    use_case: string;
    priority: number;
    is_active: boolean;
    max_tokens_override: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

type UseCase = 'chat' | 'analysis';

const PROVIDERS = ['groq', 'gemini', 'bedrock'] as const;

export function ModelRoutingTab() {
    const [chatModels, setChatModels] = useState<RoutingEntry[]>([]);
    const [analysisModels, setAnalysisModels] = useState<RoutingEntry[]>([]);
    const [activeUseCase, setActiveUseCase] = useState<UseCase>('chat');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const [showAddForm, setShowAddForm] = useState(false);
    const [newModelId, setNewModelId] = useState('');
    const [newProvider, setNewProvider] = useState<string>('groq');
    const [isAdding, setIsAdding] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/owner/model-routing', { cache: 'no-store' });
            if (!res.ok) throw new Error('Failed to load');
            const data = await res.json();
            setChatModels(data.chat ?? []);
            setAnalysisModels(data.analysis ?? []);
            setHasChanges(false);
        } catch {
            toast.error('Failed to load model routing data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const models = activeUseCase === 'chat' ? chatModels : analysisModels;
    const setModels = activeUseCase === 'chat' ? setChatModels : setAnalysisModels;

    const moveUp = (index: number) => {
        if (index <= 0) return;
        const updated = [...models];
        [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
        updated.forEach((m, i) => { m.priority = (i + 1) * 10; });
        setModels(updated);
        setHasChanges(true);
    };

    const moveDown = (index: number) => {
        if (index >= models.length - 1) return;
        const updated = [...models];
        [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
        updated.forEach((m, i) => { m.priority = (i + 1) * 10; });
        setModels(updated);
        setHasChanges(true);
    };

    const toggleActive = (index: number) => {
        const updated = [...models];
        updated[index] = { ...updated[index], is_active: !updated[index].is_active };
        setModels(updated);
        setHasChanges(true);
    };

    const removeEntry = async (entry: RoutingEntry) => {
        if (!confirm(`Remove ${entry.model_id} from ${entry.use_case}?`)) return;
        try {
            const res = await fetch('/api/owner/model-routing', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entry.id }),
            });
            if (!res.ok) throw new Error('Delete failed');
            toast.success(`Removed ${entry.model_id}`);
            await loadData();
        } catch {
            toast.error('Failed to remove model');
        }
    };

    const saveOrder = async () => {
        setIsSaving(true);
        try {
            const updates = models.map((m) => ({
                id: m.id,
                priority: m.priority,
                is_active: m.is_active,
            }));
            const res = await fetch('/api/owner/model-routing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates }),
            });
            if (!res.ok) throw new Error('Save failed');
            toast.success('Routing order saved');
            setHasChanges(false);
        } catch {
            toast.error('Failed to save routing order');
        } finally {
            setIsSaving(false);
        }
    };

    const addModel = async () => {
        if (!newModelId.trim()) return;
        setIsAdding(true);
        try {
            const maxPriority = models.length > 0
                ? Math.max(...models.map((m) => m.priority))
                : 0;
            const res = await fetch('/api/owner/model-routing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: newModelId.trim(),
                    provider: newProvider,
                    use_case: activeUseCase,
                    priority: maxPriority + 10,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Add failed');
            }
            toast.success(`Added ${newModelId.trim()} to ${activeUseCase}`);
            setNewModelId('');
            setShowAddForm(false);
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to add model');
        } finally {
            setIsAdding(false);
        }
    };

    const providerColor = (provider: string) => {
        switch (provider) {
            case 'groq': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'gemini': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
            case 'bedrock': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            default: return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
        }
    };

    if (isLoading) {
        return (
            <Card className="p-8 text-center bg-(--surface-1)/40 border-(--surface-edge)/50">
                <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-400" />
                <p className="text-zinc-400 mt-3">Loading model routing...</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">AI Model Routing</h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Control which models serve chat and analysis requests. Lower priority = tried first.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {hasChanges && (
                        <Button
                            onClick={saveOrder}
                            disabled={isSaving}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Save Order
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="border-zinc-700 text-zinc-300 hover:text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Model
                    </Button>
                </div>
            </div>

            <div className="flex gap-2">
                {(['chat', 'analysis'] as const).map((uc) => (
                    <button
                        key={uc}
                        onClick={() => setActiveUseCase(uc)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                            activeUseCase === uc
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        {uc === 'chat' ? 'Chat Models' : 'Analysis Models'}
                        <span className="ml-2 text-xs opacity-60">
                            ({(uc === 'chat' ? chatModels : analysisModels).filter((m) => m.is_active).length} active)
                        </span>
                    </button>
                ))}
            </div>

            {showAddForm && (
                <Card className="p-4 bg-(--surface-1)/40 border-(--surface-edge)/50 space-y-3">
                    <h3 className="text-sm font-semibold text-zinc-300">Add Model to {activeUseCase}</h3>
                    <div className="flex gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-xs text-zinc-500 mb-1 block">Model ID</label>
                            <input
                                type="text"
                                value={newModelId}
                                onChange={(e) => setNewModelId(e.target.value)}
                                placeholder="e.g. llama-3.3-70b-versatile"
                                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                            />
                            {newModelId.toLowerCase().includes('preview') && (
                                <p className="text-xs text-amber-400 mt-1">
                                    ⚠️ Model IDs with "preview" suffix may not be valid. Verify against the official model list before adding.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-zinc-500 mb-1 block">Provider</label>
                            <select
                                value={newProvider}
                                onChange={(e) => setNewProvider(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-amber-500"
                            >
                                {PROVIDERS.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <Button
                            onClick={addModel}
                            disabled={isAdding || !newModelId.trim()}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                        </Button>
                    </div>
                </Card>
            )}

            <Card className="bg-(--surface-1)/40 border-(--surface-edge)/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-145">
                        {models.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500">
                                No models configured for {activeUseCase}. Add one above.
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-800">
                                <div className="grid grid-cols-[40px_1fr_100px_80px_80px_80px] gap-3 px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                    <span>#</span>
                                    <span>Model</span>
                                    <span>Provider</span>
                                    <span>Priority</span>
                                    <span>Active</span>
                                    <span>Actions</span>
                                </div>
                                {models.map((entry, index) => (
                                    <div
                                        key={entry.id}
                                        className={`grid grid-cols-[40px_1fr_100px_80px_80px_80px] gap-3 px-4 py-3 items-center transition-colors ${
                                            entry.is_active ? 'hover:bg-white/5' : 'opacity-50 bg-zinc-900/30'
                                        }`}
                                    >
                                        <span className="text-zinc-500 font-mono text-sm">{index + 1}</span>
                                        <div>
                                            <span className="text-white font-medium text-sm">{entry.model_id}</span>
                                            {entry.notes && (
                                                <span className="text-zinc-500 text-xs ml-2">{entry.notes}</span>
                                            )}
                                        </div>
                                        <Badge variant="outline" className={providerColor(entry.provider)}>
                                            {entry.provider}
                                        </Badge>
                                        <span className="text-zinc-400 font-mono text-sm">{entry.priority}</span>
                                        <button
                                            onClick={() => toggleActive(index)}
                                            className="flex items-center"
                                            title={entry.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            {entry.is_active ? (
                                                <ToggleRight className="w-6 h-6 text-green-400" />
                                            ) : (
                                                <ToggleLeft className="w-6 h-6 text-zinc-600" />
                                            )}
                                        </button>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => moveUp(index)}
                                                disabled={index === 0}
                                                className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-zinc-400"
                                                title="Move up (higher priority)"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => moveDown(index)}
                                                disabled={index === models.length - 1}
                                                className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-zinc-400"
                                                title="Move down (lower priority)"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => removeEntry(entry)}
                                                className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400"
                                                title="Remove"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            <Card className="p-4 bg-amber-500/5 border-amber-500/20">
                <p className="text-amber-300 text-sm font-medium">How routing works</p>
                <p className="text-zinc-400 text-xs mt-1">
                    Models are tried in priority order (lowest number first). If a model hits rate limits,
                    the next model in the list is tried. Chat models handle interview conversation; analysis
                    models handle scoring and evaluation with structured JSON output.
                </p>
            </Card>
        </div>
    );
}