'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Link as LinkIcon, Download, Trash2, Users, Clock, AlertCircle, BarChart2, MessageSquare, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RadarChart } from '@/components/charts/RadarChart';
import { useRouter } from 'next/navigation';
import { CandidateTranscriptViewer } from './CandidateTranscriptViewer';

interface ProblemData {
    id: string;
    title: string;
    difficulty: string;
}

interface CampaignData {
    id: string;
    title: string;
    problem_id: string;
    time_limit_mins: number;
    expires_at: string | null;
    max_uses: number | null;
    uses_count: number;
    is_active: boolean;
    public_token: string;
    show_score_to_candidate: boolean;
    completed_count?: number;
    created_at: string;
}

interface SubmissionData {
    id: string;
    session_id?: string;
    campaign_id: string;
    candidate_name: string;
    candidate_email: string;
    status: string;
    overall_score: number;
    completed_at: string;
    rank?: number;

    // Joined from assessments
    problem_decomposition: number;
    pattern_recognition: number;
    algorithmic_thinking: number;
    complexity_analysis: number;
    communication_clarity: number;
    edge_case_awareness: number;
    optimization_mindset: number;
    debugging_approach: number;
}

interface EmployerDashboardProps {
    initialCampaigns: CampaignData[];
    availableProblems: ProblemData[];
}

export function EmployerDashboard({ initialCampaigns, availableProblems }: EmployerDashboardProps) {
    const [activeTab, setActiveTab] = useState<'campaigns' | 'submissions'>('campaigns');
    const [campaigns, setCampaigns] = useState<CampaignData[]>(initialCampaigns);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaigns[0]?.id || null);
    const router = useRouter();

    // Submissions State
    const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaign, setNewCampaign] = useState({
        title: '',
        timeLimit: '45',
        maxUses: '',
        expiresAt: '',
        showScoreToCandidate: false,
        assignmentMode: 'fixed' as 'fixed' | 'pool' | 'random_difficulty',
        problemId: availableProblems[0]?.id || '',
        problemPool: [] as string[],
        poolDifficulty: 'medium' as 'easy' | 'medium' | 'hard',
    });
    const [isCreating, setIsCreating] = useState(false);

    // Compare State
    const [compareSelection, setCompareSelection] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);

    // Transcript Viewer State
    const [viewTranscriptSessionId, setViewTranscriptSessionId] = useState<string | null>(null);
    const [viewTranscriptCandidateName, setViewTranscriptCandidateName] = useState<string>('');

    const fetchWithAuthCheck = async (url: string, options?: RequestInit) => {
        const res = await fetch(url, options);
        if (res.status === 401) {
            router.push('/login?reason=session_expired');
            return null;
        }
        return res;
    };

    // Fetch Submissions when tab changes or campaign changes
    useEffect(() => {
        if (activeTab === 'submissions' && selectedCampaignId) {
            loadSubmissions(selectedCampaignId);
        }
    }, [activeTab, selectedCampaignId]);

    const loadSubmissions = async (campaignId: string) => {
        setIsLoadingSubmissions(true);
        try {
            const res = await fetchWithAuthCheck(`/api/employer/submissions/${campaignId}`);
            if (res && res.ok) {
                const data = await res.json();
                setSubmissions(data.submissions || []);
            }
        } catch (err) {
            console.error('Failed to load submissions', err);
        } finally {
            setIsLoadingSubmissions(false);
        }
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const payload: Record<string, unknown> = {
                title: newCampaign.title,
                timeLimitMins: parseInt(newCampaign.timeLimit),
                maxUses: newCampaign.maxUses ? parseInt(newCampaign.maxUses) : undefined,
                expiresAt: newCampaign.expiresAt ? new Date(newCampaign.expiresAt).toISOString() : undefined,
                showScoreToCandidate: newCampaign.showScoreToCandidate,
                assignmentMode: newCampaign.assignmentMode,
            };

            if (newCampaign.assignmentMode === 'fixed') {
                payload.problemId = newCampaign.problemId;
            } else if (newCampaign.assignmentMode === 'pool') {
                payload.questionPool = newCampaign.problemPool;
            } else {
                payload.poolDifficulty = newCampaign.poolDifficulty;
            }

            const res = await fetchWithAuthCheck('/api/employer/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res) return; // 401 redirect handled inside fetchWithAuthCheck
            if (!res.ok) throw new Error("Failed to create campaign");

            const data = await res.json();
            setCampaigns([data.campaign, ...campaigns]);
            setIsCreateModalOpen(false);
            setNewCampaign({
                title: '', problemId: availableProblems[0]?.id || '', timeLimit: '45', maxUses: '', expiresAt: '', showScoreToCandidate: false, assignmentMode: 'fixed', problemPool: [], poolDifficulty: 'medium'
            });

            if (!selectedCampaignId) {
                setSelectedCampaignId(data.campaign.id);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to create campaign");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this campaign? Candidates will no longer be able to use its generic link.')) return;

        try {
            const res = await fetchWithAuthCheck(`/api/employer/campaigns/${id}`, {
                method: 'DELETE'
            });

            if (res && res.ok) {
                setCampaigns(campaigns.map(c => c.id === id ? { ...c, is_active: false } : c));
            }
        } catch (err) {
            console.error('Failed to deactivate', err);
        }
    };

    const copyLink = (token: string) => {
        const url = `${window.location.origin}/assess/${token}`;
        navigator.clipboard.writeText(url);
        toast.success('Assessment link copied to clipboard!');
    };

    const toggleCompareSubmission = (id: string) => {
        if (compareSelection.includes(id)) {
            setCompareSelection(compareSelection.filter(sId => sId !== id));
        } else if (compareSelection.length < 2) {
            setCompareSelection([...compareSelection, id]);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 7.0) return 'text-green-400 bg-green-400/10';
        if (score >= 4.0) return 'text-amber-400 bg-amber-400/10';
        return 'text-red-400 bg-red-400/10';
    };

    return (
        <div className="space-y-6">
            {/* Header section with Create Campaign Button */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Campaign Management</h1>
                    <p className="text-slate-400">Manage technical assessments and review candidate performance.</p>
                </div>
                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Campaign
                </Button>
            </div>

            {/* Tabs & Controls */}
            <div className="flex border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={cn(
                        "px-6 py-3 font-medium transition-colors border-b-2",
                        activeTab === 'campaigns'
                            ? "border-blue-500 text-blue-400"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                >
                    Campaigns
                </button>
                <button
                    onClick={() => setActiveTab('submissions')}
                    className={cn(
                        "px-6 py-3 font-medium transition-colors border-b-2",
                        activeTab === 'submissions'
                            ? "border-blue-500 text-blue-400"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                    )}
                >
                    Submissions Ranking
                </button>
            </div>

            {/* TAB 1: CAMPAIGNS */}
            {activeTab === 'campaigns' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                            <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg text-slate-300 font-medium">No Campaigns Yet</h3>
                            <p className="mt-2">Create your first technical assessment campaign to start screening candidates.</p>
                        </div>
                    ) : (
                        campaigns.map(campaign => {
                            const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();
                            const isMax = campaign.max_uses && campaign.uses_count >= campaign.max_uses;
                            const status = !campaign.is_active ? 'Deactivated' : (isExpired ? 'Expired' : (isMax ? 'Full' : 'Active'));
                            const statusColor = status === 'Active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-slate-800 text-slate-400 border-slate-700';

                            return (
                                <Card key={campaign.id} className="bg-slate-900 border-slate-800 flex flex-col hover:border-blue-500/30 transition-all">
                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-bold text-lg text-slate-200 truncate pr-4" title={campaign.title}>
                                                {campaign.title}
                                            </h3>
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                                                {status}
                                            </span>
                                        </div>

                                        <div className="space-y-3 text-sm text-slate-400 mb-6">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                <span>{campaign.completed_count !== undefined ? campaign.completed_count : campaign.uses_count} completed</span>
                                                <span className="text-slate-500 text-[10px] ml-1">
                                                    ({campaign.uses_count} {campaign.max_uses ? `/ ${campaign.max_uses}` : ''} started)
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                <span>{campaign.time_limit_mins} mins</span>
                                            </div>
                                            <div className="text-xs text-slate-500 mt-4">
                                                Created {new Date(campaign.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex flex-wrap gap-2 justify-between">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-300 hover:text-white hover:bg-slate-800"
                                            onClick={() => {
                                                setSelectedCampaignId(campaign.id);
                                                setActiveTab('submissions');
                                            }}
                                        >
                                            <BarChart2 className="w-4 h-4 mr-2" />
                                            Results
                                        </Button>

                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Copy Link"
                                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                                onClick={() => copyLink(campaign.public_token)}
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                            </Button>

                                            {campaign.is_active && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Deactivate"
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    onClick={() => handleDeactivate(campaign.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>
            )}

            {/* TAB 2: SUBMISSIONS */}
            {activeTab === 'submissions' && (
                <div className="space-y-6">
                    {/* Filter & Compare Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-sm">Campaign:</span>
                            <select
                                className="bg-slate-950 border border-slate-800 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                                value={selectedCampaignId || ''}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                            >
                                <option value="" disabled>Select a campaign...</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                        </div>

                        {compareSelection.length === 2 && (
                            <Button
                                onClick={() => setShowCompareModal(true)}
                                className="bg-purple-600 hover:bg-purple-700 text-white animate-in zoom-in-95"
                            >
                                <BarChart2 className="w-4 h-4 mr-2" />
                                Compare Selected ({compareSelection.length})
                            </Button>
                        )}
                        {compareSelection.length === 1 && (
                            <span className="text-sm text-slate-500 italic">Select one more candidate to compare</span>
                        )}
                    </div>

                    {/* Table */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden overflow-x-auto">
                        <table className="w-full text-sm text-left text-slate-300 whitespace-nowrap">
                            <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                                <tr>
                                    <th scope="col" className="px-4 py-3 w-10">Comp</th>
                                    <th scope="col" className="px-4 py-3">Rank</th>
                                    <th scope="col" className="px-6 py-3">Candidate</th>
                                    <th scope="col" className="px-4 py-3">Overall</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Problem Decomposition">Decomp</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Pattern Recognition">Pattern</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Algorithmic Thinking">Algo</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Complexity Analysis">Cmplx</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Communication Clarity">Comm</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Edge Case Awareness">Edge</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Optimization Mindset">Optim</th>
                                    <th scope="col" className="px-3 py-3 text-center" title="Debugging Approach">Debug</th>
                                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="px-6 py-12 text-center text-slate-500">
                                            {selectedCampaignId ? "No candidates have completed this assessment yet." : "Please select a campaign."}
                                        </td>
                                    </tr>
                                ) : (
                                    submissions.map((sub, i) => (
                                        <tr key={sub.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={compareSelection.includes(sub.id)}
                                                    onChange={() => toggleCompareSubmission(sub.id)}
                                                    disabled={!compareSelection.includes(sub.id) && compareSelection.length >= 2}
                                                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 focus:ring-2 focus:ring-offset-slate-900"
                                                />
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-200">#{i + 1}</td>
                                            <td className="px-6 py-3">
                                                <div className="font-semibold text-white">{sub.candidate_name || 'Anonymous'}</div>
                                                <div className="text-xs text-slate-500">{sub.candidate_email || 'No email provided'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded font-bold ${getScoreColor(sub.overall_score)}`}>
                                                    {sub.overall_score?.toFixed(1) || 'N/A'}
                                                </span>
                                            </td>

                                            {/* Skill Columns */}
                                            {['problem_decomposition', 'pattern_recognition', 'algorithmic_thinking', 'complexity_analysis', 'communication_clarity', 'edge_case_awareness', 'optimization_mindset', 'debugging_approach'].map((skill) => {
                                                const score = (sub as any)[skill] || 0;
                                                return (
                                                    <td key={skill} className="px-3 py-3 text-center font-mono text-xs">
                                                        <span className={score >= 7 ? 'text-green-400' : score >= 4 ? 'text-amber-400' : 'text-red-400'}>
                                                            {score > 0 ? score.toFixed(1) : '-'}
                                                        </span>
                                                    </td>
                                                );
                                            })}

                                            <td className="px-4 py-3 text-right">
                                                <div className="flex gap-1 justify-end">
                                                    {sub.session_id ? (
                                                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300"
                                                            onClick={() => {
                                                                setViewTranscriptSessionId(sub.session_id!);
                                                                setViewTranscriptCandidateName(sub.candidate_name || 'Anonymous');
                                                            }}
                                                            title="View Transcript"
                                                        >
                                                            <MessageSquare className="w-4 h-4" />
                                                        </Button>
                                                    ) : null}
                                                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-300"
                                                        onClick={() => toast.info('PDF Downloads interface via PDFReport coming soon in upcoming modules.')}
                                                        title="Download Report"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Campaign Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <Card className="bg-slate-900/90 border-slate-700/50 w-full max-w-lg shadow-2xl overflow-hidden glass-morphism animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between bg-slate-900/40">
                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-400" />
                                Create New Campaign
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="text-slate-500 hover:text-white transition-colors"
                            >
                                <Users className="w-5 h-5" /> {/* Close icon placeholder if needed, but usually just 'X' or similar */}
                            </button>
                        </div>
                        <form onSubmit={handleCreateCampaign} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Campaign Title *</label>
                                <Input
                                    required
                                    placeholder="e.g. SDE-2 Final Round"
                                    value={newCampaign.title}
                                    onChange={e => setNewCampaign({ ...newCampaign, title: e.target.value })}
                                    className="bg-slate-950 border-slate-800"
                                />
                            </div>
                            {/* Assignment Mode Tabs */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Assignment Type</label>
                                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                                    {(['fixed', 'pool', 'random_difficulty'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setNewCampaign({ ...newCampaign, assignmentMode: mode })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${newCampaign.assignmentMode === mode
                                                ? 'bg-blue-600 border-blue-500 text-white'
                                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                                                }`}
                                        >
                                            {mode === 'fixed' ? '📌 Fixed Problem'
                                                : mode === 'pool' ? '🎯 Problem Pool (up to 3)'
                                                    : '🎲 Random by Difficulty'}
                                        </button>
                                    ))}
                                </div>

                                {/* Fixed mode */}
                                {newCampaign.assignmentMode === 'fixed' && (
                                    <ProblemSearchSelect
                                        problems={availableProblems}
                                        value={newCampaign.problemId}
                                        onChange={(id) => setNewCampaign({ ...newCampaign, problemId: id })}
                                    />
                                )}

                                {/* Pool mode */}
                                {newCampaign.assignmentMode === 'pool' && (
                                    <ProblemPoolSelector
                                        problems={availableProblems}
                                        selected={newCampaign.problemPool}
                                        max={3}
                                        onChange={(pool) => setNewCampaign({ ...newCampaign, problemPool: pool })}
                                    />
                                )}

                                {/* Random difficulty mode */}
                                {newCampaign.assignmentMode === 'random_difficulty' && (
                                    <div>
                                        <label className="text-sm text-slate-400 mb-2 block">
                                            System will randomly assign any problem at this difficulty level to each candidate
                                        </label>
                                        <select
                                            value={newCampaign.poolDifficulty}
                                            onChange={e => setNewCampaign({ ...newCampaign, poolDifficulty: e.target.value as any })}
                                            className="w-full bg-slate-950 border border-slate-800 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                        >
                                            <option value="easy">Easy</option>
                                            <option value="medium">Medium</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Time Limit *</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                        <select
                                            className="w-full bg-slate-950/50 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                                            value={newCampaign.timeLimit}
                                            onChange={e => setNewCampaign({ ...newCampaign, timeLimit: e.target.value })}
                                        >
                                            <option value="30">30 minutes</option>
                                            <option value="45">45 minutes</option>
                                            <option value="60">60 minutes</option>
                                            <option value="90">90 minutes</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Max Responses</label>
                                    <Input
                                        type="number"
                                        placeholder="Optional (e.g. 50)"
                                        min="1"
                                        value={newCampaign.maxUses}
                                        onChange={e => setNewCampaign({ ...newCampaign, maxUses: e.target.value })}
                                        className="bg-slate-950/50 border-slate-800 focus:ring-blue-500/50"
                                    />
                                </div>
                            </div>
                            <div className="pt-2">
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Expiration Date</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                                    <Input
                                        type="datetime-local"
                                        value={newCampaign.expiresAt}
                                        onChange={e => setNewCampaign({ ...newCampaign, expiresAt: e.target.value })}
                                        className="bg-slate-950/50 border-slate-800 pl-10 [color-scheme:dark] focus:ring-blue-500/50 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center mt-4">
                                <input
                                    id="showScoreToggle"
                                    type="checkbox"
                                    checked={newCampaign.showScoreToCandidate}
                                    onChange={e => setNewCampaign({ ...newCampaign, showScoreToCandidate: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 bg-slate-950 border-slate-800 rounded focus:ring-blue-500 focus:ring-2"
                                />
                                <label htmlFor="showScoreToggle" className="ml-2 text-sm text-slate-300">
                                    Show calculated score to candidate upon completion
                                </label>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-800 mt-6">
                                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
                                    {isCreating ? 'Creating...' : 'Create Campaign'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Compare Modal */}
            {showCompareModal && compareSelection.length === 2 && (() => {
                const c1 = submissions.find(s => s.id === compareSelection[0])!;
                const c2 = submissions.find(s => s.id === compareSelection[1])!;

                // Map the row columns back into the shape RadarChart expects
                const scores1: Record<string, number> = {
                    problem_decomposition: c1.problem_decomposition,
                    pattern_recognition: c1.pattern_recognition,
                    algorithmic_thinking: c1.algorithmic_thinking,
                    complexity_analysis: c1.complexity_analysis,
                    communication_clarity: c1.communication_clarity,
                    edge_case_awareness: c1.edge_case_awareness,
                    optimization_mindset: c1.optimization_mindset,
                    debugging_approach: c1.debugging_approach
                };

                const scores2: Record<string, number> = {
                    problem_decomposition: c2.problem_decomposition,
                    pattern_recognition: c2.pattern_recognition,
                    algorithmic_thinking: c2.algorithmic_thinking,
                    complexity_analysis: c2.complexity_analysis,
                    communication_clarity: c2.communication_clarity,
                    edge_case_awareness: c2.edge_case_awareness,
                    optimization_mindset: c2.optimization_mindset,
                    debugging_approach: c2.debugging_approach
                };

                return (
                    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 min-h-screen overflow-y-auto">
                        <Card className="bg-slate-900 border-slate-700 w-full max-w-4xl shadow-2xl my-8">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-purple-400" />
                                    Candidate Comparison
                                </h3>
                                <Button variant="ghost" onClick={() => setShowCompareModal(false)} size="sm" className="text-slate-400 hover:text-white">
                                    Close
                                </Button>
                            </div>

                            <div className="p-6 space-y-8">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
                                        <div className="text-sm text-blue-400 font-medium mb-1 line-clamp-1">{c1.candidate_name || 'Candidate 1'}</div>
                                        <div className="text-3xl font-bold text-slate-100">{c1.overall_score.toFixed(1)}</div>
                                        <div className="text-xs text-slate-500 mt-1">Overall Vector</div>
                                    </div>
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
                                        <div className="text-sm text-purple-400 font-medium mb-1 line-clamp-1">{c2.candidate_name || 'Candidate 2'}</div>
                                        <div className="text-3xl font-bold text-slate-100">{c2.overall_score.toFixed(1)}</div>
                                        <div className="text-xs text-slate-500 mt-1">Overall Vector</div>
                                    </div>
                                </div>

                                {/* Radar Comparison Chart */}
                                <div className="bg-slate-950 rounded-xl p-4 border border-slate-800/50 relative">
                                    <RadarChart
                                        currentData={scores1}
                                        previousScores={scores2}
                                        showComparison={true}
                                        showAllTime={false}
                                        size="large"
                                    />
                                    <div className="absolute top-4 right-4 flex flex-col gap-2 text-xs bg-slate-900/80 p-3 rounded-lg border border-slate-800 backdrop-blur-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500 border border-slate-900"></div>
                                            <span className="text-slate-200">{c1.candidate_name || 'Candidate 1'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-purple-500 border border-slate-900"></div>
                                            <span className="text-slate-200">{c2.candidate_name || 'Candidate 2'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                );
            })()}

            {/* Transcript Viewer Modal */}
            {viewTranscriptSessionId && (
                <CandidateTranscriptViewer
                    sessionId={viewTranscriptSessionId}
                    candidateName={viewTranscriptCandidateName}
                    onClose={() => setViewTranscriptSessionId(null)}
                />
            )}
        </div>
    );
}

function ProblemSearchSelect({ problems, value, onChange }: {
    problems: ProblemData[], value: string, onChange: (id: string) => void
}) {
    const [search, setSearch] = useState('');
    const [diffFilter, setDiffFilter] = useState('');

    const filtered = problems.filter(p => {
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        const matchDiff = !diffFilter || p.difficulty === diffFilter;
        return matchSearch && matchDiff;
    });

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Search problems..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-slate-950/50 border-slate-800 focus:ring-blue-500/50"
                    />
                </div>
                <select
                    value={diffFilter}
                    onChange={e => setDiffFilter(e.target.value)}
                    className="bg-slate-950/50 border border-slate-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                    <option value="">All Levels</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-800/50 rounded-lg p-2 bg-slate-950/30 custom-scrollbar">
                {filtered.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onChange(p.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group ${value === p.id
                            ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50'
                            : 'text-slate-400 hover:bg-slate-800/50 border border-transparent'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${p.difficulty === 'easy' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]'
                                : p.difficulty === 'medium' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                                    : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                                }`} />
                            <span className="font-medium group-hover:text-slate-200 transition-colors">{p.title}</span>
                        </div>
                        {value === p.id && <Check className="w-4 h-4 text-blue-400 animate-in zoom-in duration-200" />}
                    </button>
                ))}
                {filtered.length === 0 && (
                    <div className="text-center py-6 text-slate-500 text-xs italic">No matching problems found.</div>
                )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium px-1 flex items-center justify-between">
                <span>{filtered.length} of {problems.length} problems</span>
                <span className="text-blue-500/70 select-none">Scroll for more</span>
            </p>
        </div>
    );
}

function ProblemPoolSelector({ problems, selected, max, onChange }: {
    problems: ProblemData[], selected: string[], max: number, onChange: (pool: string[]) => void
}) {
    const [search, setSearch] = useState('');
    const [diffFilter, setDiffFilter] = useState('');

    const filtered = problems.filter(p => {
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        const matchDiff = !diffFilter || p.difficulty === diffFilter;
        return matchSearch && matchDiff;
    });

    const toggle = (id: string) => {
        if (selected.includes(id)) {
            onChange(selected.filter(s => s !== id));
        } else if (selected.length < max) {
            onChange([...selected, id]);
        }
    };

    const selectedProblems = problems.filter(p => selected.includes(p.id));

    return (
        <div className="space-y-2">
            <p className="text-sm text-slate-400">
                Select up to {max} problems. Each candidate gets a randomly assigned one.
                ({selected.length}/{max} selected)
            </p>
            {/* Selected problems pills */}
            {selectedProblems.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {selectedProblems.map(p => (
                        <span key={p.id} className="flex items-center gap-1 px-2 py-1 bg-blue-900/40 border border-blue-700 rounded text-xs text-blue-300">
                            {p.title}
                            <button type="button" onClick={() => toggle(p.id)} className="text-blue-400 hover:text-red-400 ml-1">×</button>
                        </span>
                    ))}
                </div>
            )}
            {/* Search + filter */}
            <div className="flex gap-2">
                <Input
                    placeholder="Search problems..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 bg-slate-950 border-slate-800"
                />
                <select
                    value={diffFilter}
                    onChange={e => setDiffFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-md px-3 py-2 text-sm"
                >
                    <option value="">All Levels</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>
            {/* Problem list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-2 bg-slate-950">
                {filtered.map(p => {
                    const isSelected = selected.includes(p.id);
                    const isDisabled = !isSelected && selected.length >= max;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => toggle(p.id)}
                            className={`w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center justify-between ${isSelected ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                                : isDisabled ? 'opacity-40 cursor-not-allowed text-slate-500 border border-transparent'
                                    : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                                }`}
                        >
                            <div>
                                <span className={`font-bold mr-2 text-xs uppercase tracking-wider ${p.difficulty === 'easy' ? 'text-green-400'
                                    : p.difficulty === 'medium' ? 'text-amber-400'
                                        : 'text-red-400'
                                    }`}>{p.difficulty}</span>
                                {p.title}
                            </div>
                            {isSelected && <span className="text-blue-400 font-bold">✓</span>}
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="text-center py-4 text-slate-500 text-sm">No problems match your filters.</div>
                )}
            </div>
        </div>
    );
}
