'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, Shield, CheckCircle2, XCircle, Clock, Trash2, Edit2, Bot, LayoutDashboard, Database, BarChart3, RotateCw } from 'lucide-react';

interface KnowledgeGap {
    id: string;
    user_query: string;
    upvotes: number;
    priority: string;
    topic?: string;
    status: string;
    ai_drafted?: boolean;
    suggested_title?: string;
    suggested_content?: string;
    admin_notes?: string;
}

interface KnowledgeChunk {
    id: string;
    title: string;
    topic: string;
    subtopic: string;
    usage_count: number;
    effectiveness_score: number;
    embedding_status: 'done' | 'pending' | 'processing' | 'failed';
    created_at: string;
}

interface Stats {
    total: number;
    embeddingStats: Record<string, number>;
}

export function KnowledgeTab() {
    const { isAdmin, loading: adminLoading } = useAdmin();
    const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
    const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
    const [stats, setStats] = useState<Stats>({ total: 0, embeddingStats: {} });
    const [activeTab, setActiveTab] = useState('queue');

    // Modal state
    const [activeGap, setActiveGap] = useState<KnowledgeGap | null>(null);
    const [isAddingManual, setIsAddingManual] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        topic: 'dsa',
        subtopic: '',
        difficulty: 'medium',
        content: '',
        keywords: '',
        adminNotes: '',
    });

    useEffect(() => {
        if (!adminLoading && isAdmin) {
            loadAllData();
        }
    }, [adminLoading, isAdmin]);

    const loadAllData = async () => {
        try {
            const [gapsRes, chunksRes] = await Promise.all([
                fetch('/api/admin/rag?view=gaps'),
                fetch('/api/admin/rag?view=chunks')
            ]);

            const gapsData = await gapsRes.json();
            const chunksData = await chunksRes.json();

            if (gapsData.gaps) setGaps(gapsData.gaps);
            if (chunksData.chunks) {
                setChunks(chunksData.chunks);
                setStats({
                    total: chunksData.total || chunksData.chunks.length,
                    embeddingStats: chunksData.stats || {}
                });
            }
        } catch (error) {
            console.error('Failed to load knowledge admin data:', error);
        }
    };

    const handleDraft = async (gap: KnowledgeGap) => {
        setDrafting(true);
        setActiveGap(gap);
        setFormData(prev => ({ ...prev, adminNotes: '' })); // clear old notes
        try {
            const res = await fetch('/api/admin/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'draft', gapId: gap.id })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setFormData({
                title: data.title || '',
                topic: gap.topic || 'dsa', // fallback topic
                subtopic: formData.subtopic,
                difficulty: 'medium',
                content: data.content || '',
                keywords: data.keywords?.join(', ') || '',
                adminNotes: formData.adminNotes,
            });

            // Refresh list to show "Drafted" status
            loadAllData();
        } catch (err) {
            alert('Failed to generate draft: ' + err);
            setActiveGap(null);
        } finally {
            setDrafting(false);
        }
    };

    const handleApprove = async () => {
        if (!activeGap && !isAddingManual) return;
        setDrafting(true);
        try {
            const res = await fetch('/api/admin/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'approve',
                    gapId: activeGap?.id,
                    ...formData,
                    keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean)
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            alert('Chunk approved and embedding triggered!');
            setActiveGap(null);
            setIsAddingManual(false);
            loadAllData();
        } catch (err) {
            alert('Failed to approve chunk: ' + err);
        } finally {
            setDrafting(false);
        }
    };

    const handleProcessPending = async () => {
        try {
            const res = await fetch('/api/admin/rag', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'process_pending' })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            alert(`Started processing ${data.count} pending chunks.`);
            loadAllData();
        } catch (err) {
            alert('Failed to process: ' + err);
        }
    };

    const openEditModal = (gap: KnowledgeGap) => {
        setIsAddingManual(false);
        setActiveGap(gap);
        setFormData({
            title: gap.suggested_title || '',
            topic: gap.topic || 'dsa',
            subtopic: '',
            difficulty: 'medium',
            content: gap.suggested_content || '',
            keywords: '',
            adminNotes: gap.admin_notes || '',
        });
    };

    const openManualModal = () => {
        setActiveGap(null);
        setIsAddingManual(true);
        setFormData({
            title: '',
            topic: 'dsa',
            subtopic: '',
            difficulty: 'medium',
            content: '',
            keywords: '',
            adminNotes: '',
        });
    };

    if (adminLoading) return <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center text-zinc-400">Loading...</div>;

    if (!isAdmin) return <div className="min-h-screen bg-[var(--surface-base)] flex items-center justify-center text-white">Access Denied</div>;

    const priorityColors: Record<string, string> = {
        critical: 'text-red-400',
        high: 'text-orange-400',
        medium: 'text-yellow-400',
        low: 'text-zinc-400',
    };

    return (
        <div className="min-h-screen bg-[var(--surface-base)] text-white pb-20">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                            <Shield className="w-4 h-4 text-indigo-500" />
                            <span className="font-medium">RAG Administration</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-1">Knowledge Base</h1>
                        <p className="text-zinc-400 text-sm">Automated pipeline for identifying missing knowledge, drafting responses, and embedding into the vector store.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="bg-[var(--surface-1)] border border-white/8 p-1 mb-6 rounded-lg">
                        <TabsTrigger value="queue" className="data-[state=active]:bg-[var(--surface-2)] text-sm">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Gaps Queue ({gaps.length})
                        </TabsTrigger>
                        <TabsTrigger value="base" className="data-[state=active]:bg-[var(--surface-2)] text-sm">
                            <Database className="w-4 h-4 mr-2" />
                            Knowledge Base
                        </TabsTrigger>
                        <TabsTrigger value="stats" className="data-[state=active]:bg-[var(--surface-2)] text-sm">
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Stats & Coverage
                        </TabsTrigger>
                    </TabsList>

                    {/* Tab 1: Queue */}
                    <TabsContent value="queue">
                        <div className="bg-[var(--surface-1)] border border-white/8 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-white/8 bg-[var(--surface-1)]/50">
                                <h2 className="font-semibold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    Prioritized Knowledge Gaps
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-[var(--surface-1)]/80 border-b border-white/8">
                                        <tr>
                                            <th className="px-6 py-3">Priority</th>
                                            <th className="px-6 py-3">Question</th>
                                            <th className="px-6 py-3">Upvotes</th>
                                            <th className="px-6 py-3">Status</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {gaps.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No pending knowledge gaps.</td>
                                            </tr>
                                        )}
                                        {gaps.map((gap) => (
                                            <tr key={gap.id} className="hover:bg-[var(--surface-2)]/20 transition-colors">
                                                <td className={`px-6 py-4 font-semibold uppercase ${priorityColors[gap.priority] || priorityColors.low}`}>
                                                    {gap.priority}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-zinc-200 line-clamp-2" title={gap.user_query}>
                                                        {gap.user_query}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1 text-zinc-300 font-mono">
                                                        <ArrowLeft className="w-3 h-3 rotate-90 text-emerald-500" />
                                                        {gap.upvotes}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {gap.ai_drafted ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                                            Drafted
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-2)] text-zinc-300">
                                                            New
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {gap.ai_drafted ? (
                                                            <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 h-8" onClick={() => openEditModal(gap)}>
                                                                <Edit2 className="w-3 h-3 mr-1" /> Review
                                                            </Button>
                                                        ) : (
                                                            <Button size="sm" variant="outline" className="border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 h-8" onClick={() => handleDraft(gap)}>
                                                                <Bot className="w-3 h-3 mr-1" /> Draft
                                                            </Button>
                                                        )}
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-500 hover:text-red-400">
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 2: Knowledge Base */}
                    <TabsContent value="base">
                        <div className="bg-[var(--surface-1)] border border-white/8 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-white/8 flex justify-between items-center bg-[var(--surface-1)]/50">
                                <h2 className="font-semibold flex items-center gap-2">
                                    <Database className="w-4 h-4 text-emerald-500" />
                                    Active Chunks ({stats.total})
                                </h2>
                                <div className="flex gap-3">
                                    {((stats.embeddingStats?.['pending'] || 0) > 0 || (stats.embeddingStats?.['failed'] || 0) > 0) && (
                                        <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 h-8" onClick={handleProcessPending}>
                                            <RotateCw className="w-4 h-4 mr-2" /> Process Pending
                                        </Button>
                                    )}
                                    <Button size="sm" className="btn-primary h-8" onClick={openManualModal}><Bot className="w-4 h-4 mr-2" /> Add Manual Chunk</Button>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-zinc-500 uppercase bg-[var(--surface-1)]/80 border-b border-white/8">
                                        <tr>
                                            <th className="px-6 py-3">Title</th>
                                            <th className="px-6 py-3">Topic / Sub</th>
                                            <th className="px-6 py-3">Usage</th>
                                            <th className="px-6 py-3">Embedding</th>
                                            <th className="px-6 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {chunks.map((chunk) => (
                                            <tr key={chunk.id} className="hover:bg-[var(--surface-2)]/20 transition-colors">
                                                <td className="px-6 py-4 font-medium text-zinc-200">
                                                    {chunk.title || 'Untitled Segment'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-2">
                                                        <span className="text-emerald-400 text-xs">{chunk.topic}</span>
                                                        <span className="text-zinc-500 text-xs">/</span>
                                                        <span className="text-zinc-300 text-xs">{chunk.subtopic}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                                                    {chunk.usage_count} hits · {(chunk.effectiveness_score * 100).toFixed(0)}% eff.
                                                </td>
                                                <td className="px-6 py-4">
                                                    {chunk.embedding_status === 'done' && <span className="flex items-center text-emerald-500 text-xs font-medium"><CheckCircle2 className="w-4 h-4 mr-1" /> Ready</span>}
                                                    {chunk.embedding_status === 'pending' && <span className="flex items-center text-amber-500 text-xs font-medium"><Clock className="w-4 h-4 mr-1" /> Pending</span>}
                                                    {chunk.embedding_status === 'processing' && <span className="flex items-center text-indigo-400 text-xs font-medium"><RotateCw className="w-4 h-4 mr-1 animate-spin" /> Processing</span>}
                                                    {chunk.embedding_status === 'failed' && <span className="flex items-center text-red-500 text-xs font-medium"><XCircle className="w-4 h-4 mr-1" /> Failed</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-white">
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Tab 3: Stats */}
                    <TabsContent value="stats">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-[var(--surface-1)] border border-white/8 p-6 rounded-xl">
                                <div className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-2"><Database className="w-4 h-4" /> Total Chunks</div>
                                <div className="text-3xl font-bold text-white">{stats.total}</div>
                            </div>
                            <div className="bg-[var(--surface-1)] border border-white/8 p-6 rounded-xl">
                                <div className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Embedded</div>
                                <div className="text-3xl font-bold text-emerald-400">{stats.embeddingStats?.['done'] || 0}</div>
                            </div>
                            <div className="bg-[var(--surface-1)] border border-white/8 p-6 rounded-xl">
                                <div className="text-sm font-medium text-zinc-400 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Pending</span>
                                    {((stats.embeddingStats?.['pending'] || 0) > 0 || (stats.embeddingStats?.['failed'] || 0) > 0) && (
                                        <button onClick={handleProcessPending} className="text-xs text-amber-500 hover:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md">Process Now</button>
                                    )}
                                </div>
                                <div className="text-3xl font-bold text-amber-400">{stats.embeddingStats?.['pending'] || 0}</div>
                            </div>
                            <div className="bg-[var(--surface-1)] border border-white/8 p-6 rounded-xl">
                                <div className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-2"><ArrowLeft className="w-4 h-4 rotate-45 text-indigo-500" /> Resolved Embedding %</div>
                                <div className="text-3xl font-bold text-indigo-400">
                                    {stats.total > 0 ? Math.round(((stats.embeddingStats?.['done'] || 0) / stats.total) * 100) : 0}%
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Approval / Edit Modal */}
            {(activeGap || isAddingManual) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-[var(--surface-base)] border border-white/8 shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/8 flex justify-between items-center bg-[var(--surface-1)]/50">
                            <h2 className="text-xl font-bold text-white">{isAddingManual ? 'Create Manual Knowledge Chunk' : 'Review Knowledge Draft'}</h2>
                            <Button variant="ghost" size="icon" onClick={() => { setActiveGap(null); setIsAddingManual(false); }} className="text-zinc-400 hover:text-white"><XCircle className="w-5 h-5" /></Button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {activeGap && (
                                <div className="bg-[var(--surface-1)] border border-indigo-500/20 p-4 rounded-xl">
                                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Original User Query</h3>
                                    <div className="text-zinc-300 italic">" {activeGap.user_query} "</div>
                                </div>
                            )}

                            {drafting && <div className="flex items-center justify-center py-12"><div className="animate-spin mr-3"><RotateCw className="text-indigo-500" /></div> Drafting with Gemini...</div>}

                            {!drafting && (
                                <div className="grid grid-cols-6 gap-6">
                                    <div className="col-span-6 md:col-span-4 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Content Title</label>
                                            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Content Body (Markdown Supported)</label>
                                            <textarea rows={12} value={formData.content} onChange={e => setFormData({ ...formData, content: e.target.value })} className="w-full px-4 py-3 rounded-lg bg-[var(--surface-1)] border border-white/8 text-zinc-300 font-mono text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors leading-relaxed" />
                                        </div>
                                    </div>

                                    <div className="col-span-6 md:col-span-2 space-y-4 bg-[var(--surface-1)]/50 p-4 rounded-xl border border-white/8">
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Topic</label>
                                            <select value={formData.topic} onChange={e => setFormData({ ...formData, topic: e.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-white focus:border-indigo-500">
                                                <option value="dsa">Data Structures & Algo</option>
                                                <option value="system-design">System Design</option>
                                                <option value="behavioral">Behavioral</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Subtopic</label>
                                            <input type="text" value={formData.subtopic} onChange={e => setFormData({ ...formData, subtopic: e.target.value })} placeholder="e.g. graphs, dynamic-programming" className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-white focus:border-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Difficulty</label>
                                            <select value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })} className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-white focus:border-indigo-500">
                                                <option value="easy">Easy</option>
                                                <option value="medium">Medium</option>
                                                <option value="hard">Hard</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Keywords</label>
                                            <input type="text" value={formData.keywords} onChange={e => setFormData({ ...formData, keywords: e.target.value })} placeholder="comma, separated" className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-white focus:border-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-zinc-400 mb-1">Admin Notes (Not Embedded)</label>
                                            <textarea rows={3} value={formData.adminNotes} onChange={e => setFormData({ ...formData, adminNotes: e.target.value })} placeholder="Internal notes" className="w-full px-4 py-2.5 rounded-lg bg-[var(--surface-1)] border border-white/8 text-zinc-300 focus:border-indigo-500" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-white/8 flex justify-end gap-3 bg-[var(--surface-1)]/50">
                            <Button variant="ghost" onClick={() => { setActiveGap(null); setIsAddingManual(false); }} className="text-zinc-400">Cancel</Button>
                            {!drafting && <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 px-8">Save & Embed Chunk</Button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
