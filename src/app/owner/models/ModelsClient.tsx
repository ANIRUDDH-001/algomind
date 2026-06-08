'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// @ts-expect-error -- automated unused local suppression
import { AlertCircle, CheckCircle2, Copy, RotateCcw, Play, Plus, Edit2, Check, X, Trash2, ToggleRight, ToggleLeft, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

interface ModelStat {
    modelId: string;
    provider: string;
    tier: number;
    rpm: number;
    tpm: number;
    rpd: number;
    isActive: boolean;
    lastVerified: string | null;
    rateLimitHits24h: number;
    status: 'active' | 'degraded' | 'deprecated';
    modelType: 'audio' | 'text';
}

interface RoutingEntry {
    id: string;
    model_id: string;
    provider: string;
    use_case: string;
    priority: number;
    is_active: boolean;
}

export function ModelsTab() {
    const [models, setModels] = useState<ModelStat[]>([]);
    const [routing, setRouting] = useState<{ chat: RoutingEntry[], analysis: RoutingEntry[] }>({ chat: [], analysis: [] });
    // @ts-expect-error -- automated unused local suppression
    const [deprecatedCount24h, setDeprecatedCount24h] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [verifyingModel, setVerifyingModel] = useState<string | null>(null);

    // Expandable row state
    const [expandedModel, setExpandedModel] = useState<string | null>(null);
    
    // Dialog states
    const [modelToDelete, setModelToDelete] = useState<string | null>(null);
    const [showAddDialog, setShowAddDialog] = useState(false);
    
    // Add Model form state
    const [isAdding, setIsAdding] = useState(false);
    const [newModel, setNewModel] = useState({ modelId: '', provider: 'groq', tier: 5, rpm: 30, tpm: 100000, rpd: 1000 });

    // Editing State (for expanded view)
    const [editValues, setEditValues] = useState<{ rpm: number; tpm: number; rpd: number }>({ rpm: 0, tpm: 0, rpd: 0 });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Routing Priority Editing State
    const [routePriorities, setRoutePriorities] = useState<Record<string, number>>({});

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [modelsRes, eventsRes, routingRes] = await Promise.all([
                fetch('/api/admin/models', { cache: 'no-store' }),
                fetch('/api/admin/events?type=model_deprecated&days=1&limit=50', { cache: 'no-store' }),
                fetch('/api/owner/model-routing', { cache: 'no-store' })
            ]);

            const modelsData = await modelsRes.json();
            const eventsData = await eventsRes.json();
            const routingData = await routingRes.json();

            setModels(modelsData.models || []);
            setDeprecatedCount24h(eventsData.events?.length || 0);
            setRouting({ chat: routingData.chat || [], analysis: routingData.analysis || [] });
        } catch (error) {
            toast.error('Failed to load model registry');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleVerify = async (modelId: string) => {
        setVerifyingModel(modelId);
        try {
            const res = await fetch('/api/admin/models/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId })
            });
            const data = await res.json();
            if (res.ok) toast.success(data.message);
            else toast.error(data.error || 'Verification failed');
            loadData();
        } catch {
            toast.error('Network error during verification');
        } finally {
            setVerifyingModel(null);
        }
    };

    const handleDeprecate = async (modelId: string) => {
        try {
            const res = await fetch('/api/admin/models', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, reason: 'Manual suspension by admin' })
            });
            if (res.ok) { toast.success('Model suspended'); loadData(); }
            else { toast.error('Failed to suspend'); }
        } catch { toast.error('Network error'); }
    };

    const handleDelete = async () => {
        if (!modelToDelete) return;
        try {
            const res = await fetch('/api/admin/models', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId: modelToDelete, hardDelete: true })
            });
            if (res.ok) { 
                toast.success('Model permanently deleted'); 
                setModelToDelete(null);
                setExpandedModel(null);
                loadData(); 
            } else { 
                toast.error('Failed to delete model'); 
            }
        } catch { toast.error('Network error'); }
    };

    const handleRestore = async (modelId: string) => {
        try {
            const res = await fetch('/api/admin/models', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, isActive: true, notes: 'Restored by admin' })
            });
            if (res.ok) { toast.success('Model restored'); loadData(); }
        } catch { toast.error('Network error'); }
    };

    const handleAddModel = async () => {
        if (!newModel.modelId) {
            toast.error('Model ID is required');
            return;
        }
        setIsAdding(true);
        try {
            const res = await fetch('/api/admin/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newModel)
            });
            if (res.ok) {
                toast.success('Model added successfully');
                setShowAddDialog(false);
                setNewModel({ modelId: '', provider: 'groq', tier: 5, rpm: 30, tpm: 100000, rpd: 1000 });
                loadData();
            } else { 
                const err = await res.json();
                toast.error(err.error || 'Failed to add model'); 
            }
        } catch { toast.error('Network error'); }
        finally { setIsAdding(false); }
    };

    const saveLimits = async (modelId: string) => {
        setIsSavingEdit(true);
        try {
            const res = await fetch('/api/admin/models', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelId, ...editValues })
            });
            if (res.ok) { toast.success('Limits saved'); loadData(); }
            else { toast.error('Failed to save limits'); }
        } catch { toast.error('Network error'); }
        finally { setIsSavingEdit(false); }
    };

    const toggleRoute = async (routeEntry: RoutingEntry | undefined, modelId: string, provider: string, useCase: string) => {
        try {
            if (routeEntry) {
                await fetch('/api/owner/model-routing', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: routeEntry.id })
                });
            } else {
                await fetch('/api/owner/model-routing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model_id: modelId, provider, use_case: useCase, priority: 100 })
                });
            }
            loadData();
        } catch { toast.error('Failed to update routing'); }
    };

    const toggleRouteActive = async (id: string, currentIsActive: boolean) => {
        try {
            await fetch('/api/owner/model-routing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentIsActive })
            });
            loadData();
        } catch { toast.error('Failed to toggle routing status'); }
    };

    const saveRoutePriority = async (id: string, newPriority: number) => {
        try {
            await fetch('/api/owner/model-routing', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, priority: newPriority })
            });
            toast.success('Priority saved');
            loadData();
        } catch { toast.error('Failed to update priority'); }
    };

    const toggleExpand = (model: ModelStat) => {
        if (expandedModel === model.modelId) {
            setExpandedModel(null);
        } else {
            setExpandedModel(model.modelId);
            setEditValues({ rpm: model.rpm, tpm: model.tpm, rpd: model.rpd });
            
            // Prefill priority states
            const cRoute = routing.chat.find(r => r.model_id === model.modelId);
            const aRoute = routing.analysis.find(r => r.model_id === model.modelId);
            setRoutePriorities(prev => ({
                ...prev,
                ...(cRoute && { [cRoute.id]: cRoute.priority }),
                ...(aRoute && { [aRoute.id]: aRoute.priority }),
            }));
        }
    };

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="text-white p-4 md:p-6 lg:p-10 pb-20">
            <div className="max-w-[1500px] mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            Unified Model Registry
                        </h1>
                        <p className="text-zinc-400 mt-2 font-medium text-sm md:text-base">
                            Monitor provider health, adjust rate limits, and configure AI routing cleanly.
                        </p>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-500/20 w-full sm:w-auto">
                        <Plus className="w-4 h-4 mr-2" /> Register New Model
                    </Button>
                </div>

                <div className="rounded-2xl overflow-hidden bg-[var(--surface-1)] border border-[var(--surface-edge)] shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left table-fixed sm:table-auto">
                            <thead className="text-[10px] uppercase font-black tracking-widest text-zinc-500 border-b border-[var(--surface-edge)] bg-[var(--surface-2)]">
                                <tr>
                                    <th className="px-3 py-4 w-10 text-center">Status</th>
                                    <th className="px-3 py-4 sm:min-w-[200px] w-[50%] sm:w-auto">Model ID</th>
                                    <th className="px-4 py-4 hidden sm:table-cell">Provider</th>
                                    <th className="px-4 py-4 hidden md:table-cell">Health</th>
                                    <th className="px-3 py-4 text-right w-24 sm:w-auto">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--surface-edge)]">
                                {isLoading ? (
                                    <tr><td colSpan={5} className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto"/></td></tr>
                                ) : models.map((model) => (
                                    <React.Fragment key={model.modelId}>
                                        <tr 
                                            className={`transition-colors cursor-pointer group ${expandedModel === model.modelId ? 'bg-indigo-500/5' : 'hover:bg-white/[0.02]'}`}
                                            onClick={() => toggleExpand(model)}
                                        >
                                            <td className="px-3 py-4 text-center">
                                                {model.status === 'active' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 mx-auto rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" title="Active & Healthy" />}
                                                {model.status === 'degraded' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 mx-auto rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse" title="Degraded" />}
                                                {model.status === 'deprecated' && <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 mx-auto rounded-full bg-zinc-600" title="Suspended" />}
                                            </td>
                                            <td className="px-3 py-4 truncate pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs sm:text-sm font-semibold text-zinc-200 group-hover:text-indigo-300 transition-colors truncate">{model.modelId}</span>
                                                    <button onClick={(e) => handleCopy(e, model.modelId)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white transition-opacity shrink-0"><Copy className="w-3 h-3"/></button>
                                                </div>
                                                <div className="sm:hidden mt-1 text-[10px] text-zinc-500 uppercase font-bold">{model.provider}</div>
                                            </td>
                                            <td className="px-4 py-4 hidden sm:table-cell">
                                                <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700 capitalize">{model.provider}</Badge>
                                            </td>
                                            <td className="px-4 py-4 hidden md:table-cell text-zinc-400 text-xs">
                                                {model.status === 'deprecated' ? (
                                                    <span className="flex items-center gap-1 text-zinc-500"><AlertCircle className="w-3 h-3"/> Suspended</span>
                                                ) : model.status === 'degraded' ? (
                                                    <span className="flex items-center gap-1 text-amber-500"><AlertCircle className="w-3 h-3"/> Degraded</span>
                                                ) : model.rateLimitHits24h > 0 ? (
                                                    <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded flex items-center w-fit gap-1"><AlertCircle className="w-3 h-3"/> {model.rateLimitHits24h} hits (24h)</span>
                                                ) : (
                                                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Healthy</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 sm:w-auto px-0 sm:px-3 border sm:border-zinc-700 border-transparent hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30 transition-all text-zinc-400 sm:text-zinc-300" 
                                                        onClick={(e) => { e.stopPropagation(); handleVerify(model.modelId); }} 
                                                        disabled={verifyingModel === model.modelId}
                                                    >
                                                        {verifyingModel === model.modelId ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <Play className="w-3.5 h-3.5 sm:mr-1" />}
                                                        <span className="hidden sm:inline">Verify</span>
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                                                        {expandedModel === model.modelId ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                        
                                        {/* Expanded Details Panel */}
                                        {expandedModel === model.modelId && (
                                            <tr>
                                                <td colSpan={5} className="p-0 border-b border-[var(--surface-edge)] bg-black/40">
                                                    {/* Wrap in relative max-w to handle overflowing table if it happens */}
                                                    <div className="p-4 md:p-6 lg:px-10 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 shadow-inner w-full left-0 sticky">
                                                        
                                                        {/* Configuration & Limits */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                                                <Edit2 className="w-4 h-4" />
                                                                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-widest">Limits Config</h4>
                                                            </div>
                                                            <div className="bg-zinc-900/80 rounded-xl p-3 sm:p-4 border border-zinc-800 space-y-3">
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <label className="text-[10px] sm:text-xs text-zinc-500 font-medium">Req per min (RPM)</label>
                                                                    <input type="number" className="w-16 sm:w-24 bg-black border border-zinc-700 rounded px-2 py-1 text-xs sm:text-sm text-right focus:border-indigo-500 focus:outline-none" value={editValues.rpm} onChange={e => setEditValues(p => ({...p, rpm: +e.target.value}))} />
                                                                </div>
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <label className="text-[10px] sm:text-xs text-zinc-500 font-medium">Tokens per min (TPM)</label>
                                                                    <input type="number" className="w-16 sm:w-24 bg-black border border-zinc-700 rounded px-2 py-1 text-xs sm:text-sm text-right focus:border-indigo-500 focus:outline-none" value={editValues.tpm} onChange={e => setEditValues(p => ({...p, tpm: +e.target.value}))} />
                                                                </div>
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <label className="text-[10px] sm:text-xs text-zinc-500 font-medium">Req per day (RPD)</label>
                                                                    <input type="number" className="w-16 sm:w-24 bg-black border border-zinc-700 rounded px-2 py-1 text-xs sm:text-sm text-right focus:border-indigo-500 focus:outline-none" value={editValues.rpd} onChange={e => setEditValues(p => ({...p, rpd: +e.target.value}))} />
                                                                </div>
                                                                <Button size="sm" className="w-full mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm" onClick={() => saveLimits(model.modelId)} disabled={isSavingEdit}>
                                                                    {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5"/> : <Check className="w-3.5 h-3.5 mr-1.5"/>} Save Limits
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {/* Routing Configuration */}
                                                        <div className="lg:col-span-2 space-y-4">
                                                            <div className="flex items-center gap-2 text-purple-400 mb-2">
                                                                <Play className="w-4 h-4" />
                                                                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-widest">Routing Integration</h4>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {/* Chat Route Card */}
                                                                <div className="bg-zinc-900/80 rounded-xl p-3 sm:p-4 border border-zinc-800 flex flex-col justify-between">
                                                                    <div>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <span className="text-sm font-bold text-zinc-300">Chat Routing</span>
                                                                            {routing.chat.find(r => r.model_id === model.modelId) ? (
                                                                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] sm:text-xs">Configured</Badge>
                                                                            ) : (
                                                                                <Badge variant="outline" className="bg-zinc-800 text-zinc-500 border-zinc-700 text-[10px] sm:text-xs">Not Added</Badge>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {(() => {
                                                                            const route = routing.chat.find(r => r.model_id === model.modelId);
                                                                            if (!route) {
                                                                                return (
                                                                                    <div className="text-center py-4">
                                                                                        <p className="text-xs text-zinc-500 mb-3">Not available for chat processing.</p>
                                                                                        <Button size="sm" variant="outline" className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 w-full sm:w-auto" onClick={() => toggleRoute(undefined, model.modelId, model.provider, 'chat')}>
                                                                                            <Plus className="w-3 h-3 mr-1"/> Add to Chat
                                                                                        </Button>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div className="space-y-3">
                                                                                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg">
                                                                                        <span className="text-[10px] sm:text-xs text-zinc-400">Status</span>
                                                                                        <button className="flex items-center gap-1.5" onClick={() => toggleRouteActive(route.id, route.is_active)}>
                                                                                            <span className="text-[10px] sm:text-xs font-semibold text-zinc-300">{route.is_active ? 'Active' : 'Paused'}</span>
                                                                                            {route.is_active ? <ToggleRight className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500"/> : <ToggleLeft className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600"/>}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg">
                                                                                        <span className="text-[10px] sm:text-xs text-zinc-400 truncate pr-2">Priority (lower=first)</span>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <input type="number" className="w-12 sm:w-16 bg-black border border-zinc-700 rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-right focus:border-indigo-500 focus:outline-none" value={routePriorities[route.id] ?? route.priority} onChange={(e) => setRoutePriorities(p => ({...p, [route.id]: +e.target.value}))} />
                                                                                            <Button size="sm" variant="ghost" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-emerald-400" onClick={() => saveRoutePriority(route.id, routePriorities[route.id])}><Check className="w-3 h-3"/></Button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    {routing.chat.find(r => r.model_id === model.modelId) && (
                                                                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-3 w-full text-xs sm:text-sm" onClick={() => toggleRoute(routing.chat.find(r => r.model_id === model.modelId), model.modelId, model.provider, 'chat')}>
                                                                            <X className="w-3 h-3 mr-1"/> Remove
                                                                        </Button>
                                                                    )}
                                                                </div>

                                                                {/* Analysis Route Card */}
                                                                <div className="bg-zinc-900/80 rounded-xl p-3 sm:p-4 border border-zinc-800 flex flex-col justify-between">
                                                                    <div>
                                                                        <div className="flex justify-between items-start mb-3">
                                                                            <span className="text-sm font-bold text-zinc-300">Analysis Routing</span>
                                                                            {routing.analysis.find(r => r.model_id === model.modelId) ? (
                                                                                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-[10px] sm:text-xs">Configured</Badge>
                                                                            ) : (
                                                                                <Badge variant="outline" className="bg-zinc-800 text-zinc-500 border-zinc-700 text-[10px] sm:text-xs">Not Added</Badge>
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {(() => {
                                                                            const route = routing.analysis.find(r => r.model_id === model.modelId);
                                                                            if (!route) {
                                                                                return (
                                                                                    <div className="text-center py-4">
                                                                                        <p className="text-xs text-zinc-500 mb-3">Not available for background analysis.</p>
                                                                                        <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 w-full sm:w-auto" onClick={() => toggleRoute(undefined, model.modelId, model.provider, 'analysis')}>
                                                                                            <Plus className="w-3 h-3 mr-1"/> Add to Analysis
                                                                                        </Button>
                                                                                    </div>
                                                                                );
                                                                            }
                                                                            return (
                                                                                <div className="space-y-3">
                                                                                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg">
                                                                                        <span className="text-[10px] sm:text-xs text-zinc-400">Status</span>
                                                                                        <button className="flex items-center gap-1.5" onClick={() => toggleRouteActive(route.id, route.is_active)}>
                                                                                            <span className="text-[10px] sm:text-xs font-semibold text-zinc-300">{route.is_active ? 'Active' : 'Paused'}</span>
                                                                                            {route.is_active ? <ToggleRight className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500"/> : <ToggleLeft className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600"/>}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg">
                                                                                        <span className="text-[10px] sm:text-xs text-zinc-400 truncate pr-2">Priority (lower=first)</span>
                                                                                        <div className="flex items-center gap-1 shrink-0">
                                                                                            <input type="number" className="w-12 sm:w-16 bg-black border border-zinc-700 rounded px-1.5 sm:px-2 py-1 text-xs sm:text-sm text-right focus:border-purple-500 focus:outline-none" value={routePriorities[route.id] ?? route.priority} onChange={(e) => setRoutePriorities(p => ({...p, [route.id]: +e.target.value}))} />
                                                                                            <Button size="sm" variant="ghost" className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-emerald-400" onClick={() => saveRoutePriority(route.id, routePriorities[route.id])}><Check className="w-3 h-3"/></Button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    {routing.analysis.find(r => r.model_id === model.modelId) && (
                                                                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 mt-3 w-full text-xs sm:text-sm" onClick={() => toggleRoute(routing.analysis.find(r => r.model_id === model.modelId), model.modelId, model.provider, 'analysis')}>
                                                                            <X className="w-3 h-3 mr-1"/> Remove
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Danger Zone Actions */}
                                                        <div className="lg:col-span-3 pt-4 border-t border-zinc-800/50 flex flex-col sm:flex-row justify-end gap-3 items-center">
                                                            {model.status === 'deprecated' ? (
                                                                <Button variant="outline" className="w-full sm:w-auto border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleRestore(model.modelId)}>
                                                                    <RotateCcw className="w-4 h-4 mr-2" /> Restore Model
                                                                </Button>
                                                            ) : (
                                                                <Button variant="outline" className="w-full sm:w-auto border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => handleDeprecate(model.modelId)}>
                                                                    Suspend Model
                                                                </Button>
                                                            )}
                                                            <Button variant="destructive" className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20" onClick={() => setModelToDelete(model.modelId)}>
                                                                <Trash2 className="w-4 h-4 mr-2" /> Hard Delete
                                                            </Button>
                                                        </div>

                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Add Model Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="bg-[var(--surface-1)] border-[var(--surface-edge)] text-white sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Register New Model</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Add a new AI model to the registry. You must configure routing separately after adding.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Model ID</label>
                            <input 
                                type="text" 
                                placeholder="e.g. llama-3.3-70b-versatile" 
                                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                                value={newModel.modelId} 
                                onChange={e => setNewModel(p => ({...p, modelId: e.target.value}))}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Provider</label>
                            <select 
                                className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
                                value={newModel.provider} 
                                onChange={e => setNewModel(p => ({...p, provider: e.target.value}))}
                            >
                                <option value="groq">Groq</option>
                                <option value="gemini">Gemini</option>
                                <option value="bedrock">AWS Bedrock</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">RPM</label>
                                <input type="number" className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-center" value={newModel.rpm} onChange={e => setNewModel(p => ({...p, rpm: +e.target.value}))}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">TPM</label>
                                <input type="number" className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-center" value={newModel.tpm} onChange={e => setNewModel(p => ({...p, tpm: +e.target.value}))}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">RPD</label>
                                <input type="number" className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-sm text-center" value={newModel.rpd} onChange={e => setNewModel(p => ({...p, rpd: +e.target.value}))}/>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowAddDialog(false)} className="text-zinc-400 hover:text-white">Cancel</Button>
                        <Button onClick={handleAddModel} disabled={isAdding || !newModel.modelId} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Add Model
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!modelToDelete} onOpenChange={(open) => !open && setModelToDelete(null)}>
                <DialogContent className="bg-[var(--surface-1)] border-red-500/20 text-white sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertCircle className="w-5 h-5" /> Confirm Hard Delete
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 pt-2">
                            Are you absolutely sure you want to completely delete <strong className="text-white font-mono">{modelToDelete}</strong> from the system?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-sm text-red-400 font-medium">
                        This action cannot be undone. All routing associations for this model will also be permanently destroyed.
                    </div>

                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setModelToDelete(null)} className="text-zinc-400 hover:text-white">Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20">
                            <Trash2 className="w-4 h-4 mr-2" /> Yes, Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
