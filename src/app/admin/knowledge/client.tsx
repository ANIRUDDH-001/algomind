'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, Shield, Plus, TrendingUp, Database, ChevronDown, ChevronUp, Edit, Trash2 } from 'lucide-react';
import { useSwipeable } from 'react-swipeable';

interface KnowledgeGap {
    id: string;
    user_query: string;
    upvotes: number;
    priority: string;
    status: string;
    best_similarity_score: number;
    created_at: string;
}

interface KnowledgeChunk {
    id: string;
    topic: string;
    subtopic: string;
    content: string;
    usage_count: number;
    effectiveness_score: number;
    status: string;
    keywords: string[];
    created_at: string;
}

export default function KnowledgeAdminPage() {
    const router = useRouter();
    const { isAdmin, loading: adminLoading } = useAdmin();
    const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
    const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('gaps');

    const tabs = ['gaps', 'chunks', 'add'];
    const handlers = useSwipeable({
        onSwipedLeft: () => {
            const idx = tabs.indexOf(activeTab);
            if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
        },
        onSwipedRight: () => {
            const idx = tabs.indexOf(activeTab);
            if (idx > 0) setActiveTab(tabs[idx - 1]);
        },
        trackMouse: false
    });

    useEffect(() => {
        if (!adminLoading && isAdmin) {
            loadData();
        }
    }, [adminLoading, isAdmin]);

    const loadData = async () => {
        setLoading(true);
        const supabase = getSupabase();
        if (!supabase) return;

        try {
            // Load knowledge gaps
            const { data: gapsData, error: gapsError } = await supabase
                .from('knowledge_gaps')
                .select('*')
                .in('status', ['new', 'in-progress'])
                .order('priority', { ascending: false })
                .order('upvotes', { ascending: false })
                .limit(50);

            if (gapsError) {
                console.error('❌ [ADMIN] Failed to load gaps:', gapsError);
                // Don't crash - show empty state
                setGaps([]);
            } else {
                setGaps(gapsData || []);
            }

            // Load knowledge chunks
            const { data: chunksData, error: chunksError } = await supabase
                .from('knowledge_chunks')
                .select('*')
                .eq('status', 'active')
                .order('usage_count', { ascending: false })
                .limit(50);

            if (chunksError) {
                console.error('❌ [ADMIN] Failed to load chunks:', chunksError);
                setChunks([]);
            } else {
                setChunks(chunksData || []);
            }

        } catch (error) {
            console.error('❌ [ADMIN] Unexpected error:', error);
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (adminLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="animate-pulse text-slate-400">Checking permissions...</div>
            </div>
        );
    }

    // Access denied for non-admins
    if (!isAdmin) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center max-w-md p-8">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-slate-400 mb-6">
                        You don't have permission to access the admin dashboard.
                        This area is restricted to authorized administrators.
                    </p>
                    <Button
                        onClick={() => router.push('/dashboard')}
                        className="bg-slate-800 hover:bg-slate-700"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        );
    }

    const priorityColors: Record<string, string> = {
        critical: 'bg-red-900/50 text-red-300 border-red-700',
        high: 'bg-orange-900/50 text-orange-300 border-orange-700',
        medium: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
        low: 'bg-slate-800 text-slate-400 border-slate-700',
    };

    return (
        <div {...handlers} className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                            <Shield className="w-4 h-4 text-green-500" />
                            <span className="font-medium">Admin Access</span>
                        </div>
                        <h1 className="text-3xl font-bold text-white">
                            RAG Knowledge Management
                        </h1>
                        <p className="text-slate-400 text-sm mt-1 mb-4 hidden md:block">
                            Review AI-detected gaps and manage the knowledge base.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/dashboard')}
                        className="border-slate-700"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Dashboard
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{gaps.length}</div>
                                <div className="text-xs text-slate-400">Knowledge Gaps</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10">
                                <Database className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{chunks.length}</div>
                                <div className="text-xs text-slate-400">DB Chunks</div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/10">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{chunks.length}</div>
                                <div className="text-xs text-slate-400">Active RAG Chunks</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    {/* Scrollable Tabs List for Mobile */}
                    <div className="overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0">
                        <TabsList className="bg-slate-800/50 border border-slate-700 p-1 rounded-xl flex w-max md:w-full">
                            <TabsTrigger value="gaps" className="rounded-lg data-[state=active]:bg-slate-700 px-4">
                                Knowledge Gaps ({gaps.length})
                            </TabsTrigger>
                            <TabsTrigger value="chunks" className="rounded-lg data-[state=active]:bg-slate-700 px-4">
                                DB Chunks ({chunks.length})
                            </TabsTrigger>
                            <TabsTrigger value="add" className="rounded-lg data-[state=active]:bg-slate-700 px-4">
                                <Plus className="w-4 h-4 mr-1" />
                                Add Chunk
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Tab 1: Knowledge Gaps */}
                    <TabsContent value="gaps">
                        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700">
                            <h2 className="text-xl font-semibold text-white mb-2">
                                Top Knowledge Gaps
                            </h2>
                            <p className="text-slate-400 text-sm mb-6">
                                Queries that RAG couldn't answer well. Higher upvotes = more users hit this gap.
                            </p>

                            {loading ? (
                                <div className="text-slate-400 text-center py-8">Loading...</div>
                            ) : gaps.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">🎉</div>
                                    <div className="text-slate-400">No knowledge gaps detected yet!</div>
                                    <div className="text-slate-500 text-sm mt-1">
                                        Run some interviews to start collecting analytics
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {gaps.map((gap) => (
                                        <div
                                            key={gap.id}
                                            className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${priorityColors[gap.priority] || priorityColors.low}`}>
                                                            {gap.priority.toUpperCase()}
                                                        </span>
                                                        <span className="text-xs text-slate-500">
                                                            {gap.upvotes} hit{gap.upvotes !== 1 ? 's' : ''}
                                                        </span>
                                                        {gap.best_similarity_score > 0 && (
                                                            <span className="text-xs text-slate-500">
                                                                Similarity: {(gap.best_similarity_score * 100).toFixed(0)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-white font-medium mb-1 break-words">
                                                        "{gap.user_query.length > 150 ? gap.user_query.slice(0, 150) + '...' : gap.user_query}"
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {new Date(gap.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-green-600 text-green-400 hover:bg-green-900/20 text-xs"
                                                        onClick={() => {
                                                            // Switch to add tab with prefilled query context
                                                            alert('Create knowledge chunk for:\n\n' + gap.user_query.slice(0, 200));
                                                        }}
                                                    >
                                                        Create Chunk
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-slate-600 text-xs"
                                                        onClick={async () => {
                                                            const supabase = getSupabase();
                                                            if (supabase) {
                                                                await supabase
                                                                    .from('knowledge_gaps')
                                                                    .update({ status: 'wont-fix' })
                                                                    .eq('id', gap.id);
                                                                loadData();
                                                            }
                                                        }}
                                                    >
                                                        Dismiss
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab 2: Active Chunks (List View) */}
                    <TabsContent value="chunks">
                        <div className="bg-slate-800/30 rounded-xl border border-slate-700 overflow-hidden">
                            <div className="p-6 border-b border-slate-700">
                                <h2 className="text-xl font-semibold text-white mb-1">
                                    Database Chunks
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    Full knowledge base content.
                                </p>
                            </div>

                            {loading ? (
                                <div className="text-slate-400 text-center py-8">Loading...</div>
                            ) : chunks.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-4">📭</div>
                                    <div className="text-slate-400">No chunks in database yet</div>
                                    <div className="text-slate-500 text-sm mt-1">
                                        Use the "Add Chunk" tab to add new knowledge
                                    </div>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-800">
                                    {/* Header Row */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-slate-900/50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <div className="col-span-4 pl-2">Topic / Subtopic</div>
                                        <div className="col-span-12 md:col-span-5">Content Preview</div>
                                        <div className="col-span-2">Stats</div>
                                        <div className="col-span-1 text-right">Action</div>
                                    </div>

                                    {/* List Rows */}
                                    {chunks.map((chunk) => (
                                        <ChunkRow key={chunk.id} chunk={chunk} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* Tab 3: Add New Chunk */}
                    <TabsContent value="add">
                        <AddKnowledgeChunkForm onSuccess={loadData} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

function ChunkRow({ chunk }: { chunk: KnowledgeChunk }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="group bg-slate-900/20 hover:bg-slate-800/50 transition-colors">
            {/* Main Row Content */}
            <div
                className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 cursor-pointer items-center"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Mobile: Topic Header */}
                <div className="col-span-12 md:col-span-4">
                    <div className="flex justify-between items-center md:hidden mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">{chunk.topic}</span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="font-medium text-white group-hover:text-blue-400 transition-colors pl-2 border-l-2 border-transparent group-hover:border-blue-500">
                        {chunk.subtopic}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1 pl-2 hidden md:block">
                        {chunk.topic}
                    </div>
                </div>

                <div className="col-span-12 md:col-span-5 text-sm text-slate-400">
                    <div className={expanded ? '' : 'line-clamp-2'}>
                        {chunk.content}
                    </div>
                </div>

                <div className="col-span-6 md:col-span-2 text-xs text-slate-500 flex flex-row md:flex-col gap-4 md:gap-1 mt-2 md:mt-0">
                    <div>Used: <span className="text-slate-300">{chunk.usage_count}</span></div>
                    <div>Score: <span className="text-green-400">{(chunk.effectiveness_score * 100).toFixed(0)}%</span></div>
                </div>

                <div className="col-span-6 md:col-span-1 text-right hidden md:block">
                    <Button size="icon" variant="ghost" className="h-8 w-8">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-4 pb-4 md:pl-4 md:ml-0 border-t border-slate-800/50 bg-slate-900/50 animate-in slide-in-from-top-2 duration-200">
                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Content</h4>
                            <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono bg-slate-950 p-4 rounded-lg border border-slate-800 shadow-inner max-h-96 overflow-y-auto">
                                {chunk.content}
                            </div>
                        </div>
                        <div className="flex flex-col justify-between">
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Metadata</h4>
                                <div className="space-y-3 text-sm bg-slate-950 p-4 rounded-lg border border-slate-800">
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500">Created</span>
                                        <span className="text-slate-300">{new Date(chunk.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-800 pb-2">
                                        <span className="text-slate-500">Status</span>
                                        <span className="text-green-400 font-bold capitalize flex items-center gap-1">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                            {chunk.status}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-2">Keywords</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {chunk.keywords?.map((k, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs border border-slate-700 shadow-sm">
                                                    {k}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800/50">
                                <Button variant="outline" size="sm" className="border-slate-700 hover:bg-slate-800 gap-2">
                                    <Edit className="w-3 h-3" /> Edit
                                </Button>
                                <Button variant="destructive" size="sm" className="bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 gap-2">
                                    <Trash2 className="w-3 h-3" /> Archive
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Form component for adding new knowledge chunks
function AddKnowledgeChunkForm({ onSuccess }: { onSuccess: () => void }) {
    const [formData, setFormData] = useState({
        topic: '',
        subtopic: '',
        content: '',
        keywords: '',
        difficulty: 'medium',
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const supabase = getSupabase();
            if (!supabase) throw new Error('Supabase not configured');

            const { error } = await supabase.from('knowledge_chunks').insert({
                topic: formData.topic.toLowerCase().replace(/\s+/g, '-'),
                subtopic: formData.subtopic.toLowerCase().replace(/\s+/g, '-'),
                content: formData.content,
                keywords: formData.keywords.split(',').map(k => k.trim().toLowerCase()),
                difficulty: formData.difficulty,
                source: 'manual',
                status: 'active',
            });

            if (error) throw error;

            alert('✅ Knowledge chunk added to database!\n\nNote: To use it in RAG, you need to regenerate embeddings.json');

            setFormData({ topic: '', subtopic: '', content: '', keywords: '', difficulty: 'medium' });
            onSuccess();
        } catch (error) {
            console.error('Failed to add chunk:', error);
            alert('Failed to add knowledge chunk: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-2">
                Add New Knowledge Chunk
            </h2>
            <p className="text-slate-400 text-sm mb-6">
                Manually add DSA knowledge. After adding, run the ingestion script to update RAG.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Topic</label>
                        <input
                            type="text"
                            required
                            value={formData.topic}
                            onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., arrays, trees, graphs"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Subtopic</label>
                        <input
                            type="text"
                            required
                            value={formData.subtopic}
                            onChange={(e) => setFormData({ ...formData, subtopic: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., two-pointer, bfs-dfs"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Content</label>
                    <textarea
                        required
                        rows={10}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                        placeholder="Detailed explanation with examples, time complexity, use cases..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Keywords (comma-separated)
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.keywords}
                            onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., array, sum, optimization"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">Difficulty</label>
                        <select
                            value={formData.difficulty}
                            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>
                </div>

                <div className="pt-2">
                    <Button
                        type="submit"
                        disabled={submitting}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 font-bold"
                    >
                        {submitting ? 'Adding...' : 'Add Knowledge Chunk'}
                    </Button>
                </div>
            </form>
        </div>
    );
}
