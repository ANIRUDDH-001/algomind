'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Link as LinkIcon, Download, Trash2, Users, Clock, AlertCircle, BarChart2, MessageSquare, Search, Check, Copy, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RadarChart } from '@/components/charts/RadarChart';
import { useRouter } from 'next/navigation';
import { CandidateTranscriptViewer } from './CandidateTranscriptViewer';
import { CreateCampaignModal } from './CreateCampaignModal';
import { CampaignData as CampaignType, CampaignQuestion } from '@/types/campaign';

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
    entry_code: string;
    show_score_to_candidate: boolean;
    completed_count?: number;
    created_at: string;
    campaign_questions?: CampaignQuestion[];
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
    created_at: string;
    updated_at: string;
    question_states: any[];
    current_problem_id: string | null;
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
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
    const [submissionsSummary, setSubmissionsSummary] = useState<any>(null);
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
    const [viewDetailsSubmissionId, setViewDetailsSubmissionId] = useState<string | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);


    // Compare State
    const [compareSelection, setCompareSelection] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);

    // Transcript Viewer State
    const [viewTranscriptSessionId, setViewTranscriptSessionId] = useState<string | null>(null);
    const [viewTranscriptCandidateName, setViewTranscriptCandidateName] = useState<string>('');
    const [viewTranscriptProblemTitle, setViewTranscriptProblemTitle] = useState<string>('');

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
    }, [activeTab, selectedCampaignId, statusFilter]);

    const loadSubmissions = async (campaignId: string) => {
        setIsLoadingSubmissions(true);
        try {
            const url = new URL(`/api/employer/submissions/${campaignId}`, window.location.origin);
            if (statusFilter !== 'all') {
                url.searchParams.set('status', statusFilter);
            }
            const res = await fetchWithAuthCheck(url.toString());
            if (res && res.ok) {
                const data = await res.json();
                setSubmissions(data.submissions || []);
                setSubmissionsSummary(data.summary || null);
            }
        } catch (err) {
            console.error('Failed to load submissions', err);
        } finally {
            setIsLoadingSubmissions(false);
        }
    };

    useEffect(() => {
        if (viewDetailsSubmissionId && selectedCampaignId) {
            loadReport(selectedCampaignId, viewDetailsSubmissionId);
        } else {
            setReportData(null);
        }
    }, [viewDetailsSubmissionId, selectedCampaignId]);

    const loadReport = async (campaignId: string, submissionId: string) => {
        setIsLoadingReport(true);
        try {
            const res = await fetchWithAuthCheck(`/api/employer/submissions/${campaignId}/report/${submissionId}`);
            if (res && res.ok) {
                const data = await res.json();
                setReportData(data);
            } else {
                toast.error('Failed to load report');
                setViewDetailsSubmissionId(null);
            }
        } catch (err) {
            console.error('Failed to load report', err);
            toast.error('Error loading report');
            setViewDetailsSubmissionId(null);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this campaign? Candidates will no longer be able to use its generic link.')) return;

        try {
            const res = await fetchWithAuthCheck(`/api/employer/campaigns/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'deactivate' })
            });

            if (res && res.ok) {
                setCampaigns(campaigns.map(c => c.id === id ? { ...c, is_active: false } : c));
                toast.success('Campaign deactivated');
            }
        } catch (err) {
            console.error('Failed to deactivate', err);
            toast.error('Failed to deactivate campaign');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('PERMANENT DELETE: This will remove the campaign and ALL associated candidate submissions. This cannot be undone. Proceed?')) return;

        try {
            const res = await fetchWithAuthCheck(`/api/employer/campaigns/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete' })
            });

            if (res && res.ok) {
                setCampaigns(campaigns.filter(c => c.id !== id));
                toast.success('Campaign deleted permanently');
                if (selectedCampaignId === id) setSelectedCampaignId(null);
            }
        } catch (err) {
            console.error('Failed to delete', err);
            toast.error('Failed to delete campaign');
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
        if (!score && score !== 0) return 'text-zinc-500 bg-zinc-800/50 border border-zinc-700/50';
        if (score >= 7.0) return 'badge-easy';
        if (score >= 4.0) return 'text-[#f59e0b] bg-[#f59e0b]/15 border border-[#f59e0b]/25';
        return 'badge-hard';
    };

    const renderStatusBadge = (status: string, updatedAtStr?: string) => {
        const statusStyle: Record<string, string> = {
            completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
            in_progress: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
            dropped_out: 'bg-red-500/15 text-red-400 border border-red-500/25',
            invited: 'bg-zinc-800 text-zinc-500 border border-zinc-700',
            time_expired: 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
        };
        const baseClass = statusStyle[status] || 'bg-zinc-800 text-zinc-500 border border-zinc-700';

        if (status === 'in_progress') {
            const minsAgo = updatedAtStr ? Math.floor((Date.now() - new Date(updatedAtStr).getTime()) / 60000) : 0;
            return (
                <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 rounded font-bold text-[10px] uppercase flex items-center gap-1.5 w-max ${baseClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span> In Progress
                    </span>
                    {minsAgo < 60 ? <span className="text-[10px] text-zinc-500">Active {minsAgo}m ago</span> : <span className="text-[10px] text-zinc-500">Active {Math.floor(minsAgo / 60)}h ago</span>}
                </div>
            );
        }

        const label = status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return <span className={`px-2 py-1 rounded font-bold text-[10px] uppercase ${baseClass}`}>{label}</span>;
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
            <div className="flex items-center gap-1 p-1.5 backdrop-blur-xl rounded-2xl w-max min-w-full sm:w-fit shadow-2xl mb-8" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={cn(
                        "px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-300",
                        activeTab === 'campaigns'
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]"
                    )}
                >
                    Campaigns
                </button>
                <button
                    onClick={() => setActiveTab('submissions')}
                    className={cn(
                        "px-6 py-2 text-sm font-semibold rounded-xl transition-all duration-300",
                        activeTab === 'submissions'
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]"
                    )}
                >
                    Submissions Ranking
                </button>
            </div >

            {/* TAB 1: CAMPAIGNS */}
            {
                activeTab === 'campaigns' && (
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

                                const qCount = campaign.campaign_questions?.length || 1;
                                const totalTime = campaign.time_limit_mins;

                                let borderLeftClass = 'border-l-zinc-700';
                                if (status === 'Active') borderLeftClass = 'border-l-emerald-500';
                                else if (status === 'Full') borderLeftClass = 'border-l-amber-500';

                                return (
                                    <Card key={campaign.id} className={`flex flex-col hover:shadow-xl transition-all border-l-[3px] ${borderLeftClass}`} style={{ background: 'var(--surface-1)', borderTopColor: 'var(--surface-edge)', borderRightColor: 'var(--surface-edge)', borderBottomColor: 'var(--surface-edge)' }}>
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
                                                    <span>{qCount} {qCount === 1 ? 'question' : 'questions'} · {totalTime} mins total</span>
                                                </div>

                                                {/* Entry Code Section */}
                                                <div className="bg-slate-950/50 border border-slate-800/50 rounded-lg p-2 flex items-center justify-between mt-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider leading-none mb-1">Entry Code</span>
                                                        <span className="font-mono text-white text-xs">{campaign.entry_code || '---'}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-400"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(campaign.entry_code);
                                                            toast.success('Code copied!');
                                                        }}
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>

                                                <div className="text-xs text-slate-500 pt-2">
                                                    Created {new Date(campaign.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950 px-3 py-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-slate-300 hover:text-white hover:bg-slate-800 justify-start"
                                                onClick={() => {
                                                    setSelectedCampaignId(campaign.id);
                                                    setActiveTab('submissions');
                                                }}
                                            >
                                                <BarChart2 className="w-4 h-4 mr-2" />
                                                View Results
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 justify-start"
                                                onClick={() => copyLink(campaign.public_token)}
                                            >
                                                <LinkIcon className="w-4 h-4 mr-2" />
                                                Copy Link
                                            </Button>

                                            {campaign.is_active ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 justify-start"
                                                    onClick={() => handleDeactivate(campaign.id)}
                                                >
                                                    <PowerOff className="w-4 h-4 mr-2" />
                                                    Deactivate
                                                </Button>
                                            ) : (
                                                <div className="flex items-center px-3 text-xs text-slate-600 gap-2">
                                                    <Power className="w-3.5 h-3.5" />
                                                    Inactive
                                                </div>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 justify-start"
                                                onClick={() => handleDelete(campaign.id)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Delete Campaign
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                )
            }

            {/* TAB 2: SUBMISSIONS */}
            {
                activeTab === 'submissions' && (
                    <div className="space-y-6">
                        {/* ... (rest of submissions tab remains the same) */}
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

                            {selectedCampaignId && (
                                <div className="ml-auto">
                                    <Button
                                        variant="outline"
                                        className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                                        onClick={async () => {
                                            try {
                                                const res = await fetchWithAuthCheck(`/api/employer/submissions/${selectedCampaignId}/export`);
                                                if (res && res.ok) {
                                                    const blob = await res.blob();
                                                    const url = URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    // Try to get filename from content-disposition if possible
                                                    const disp = res.headers.get('Content-Disposition');
                                                    let filename = 'campaign-export.csv';
                                                    if (disp) {
                                                        const match = disp.match(/filename="?([^"]+)"?/);
                                                        if (match && match[1]) filename = match[1];
                                                    }
                                                    a.download = filename;
                                                    a.click();
                                                    URL.revokeObjectURL(url);
                                                } else {
                                                    toast.error('Failed to export CSV');
                                                }
                                            } catch (e) {
                                                toast.error('Error downloading CSV');
                                            }
                                        }}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download CSV
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm border-b border-slate-800 pb-4">
                            <button onClick={() => setStatusFilter('all')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'all' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}>
                                All {submissionsSummary ? `(${submissionsSummary.total})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('completed')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'completed' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}>
                                Completed {submissionsSummary ? `(${submissionsSummary.completed})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('in_progress')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'in_progress' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}>
                                In Progress {submissionsSummary ? `(${submissionsSummary.in_progress})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('dropped_out')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'dropped_out' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}>
                                Dropped Out {submissionsSummary ? `(${submissionsSummary.dropped_out})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('time_expired')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'time_expired' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50")}>
                                Time Expired {submissionsSummary ? `(${submissionsSummary.time_expired})` : ''}
                            </button>
                        </div>

                        <div className="rounded-xl border-[var(--surface-edge)] overflow-hidden overflow-x-auto" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                            <table className="w-full text-sm text-left text-slate-300 whitespace-nowrap">
                                <thead className="text-xs text-zinc-600 uppercase border-b border-[var(--surface-edge)]" style={{ background: 'var(--surface-2)' }}>
                                    <tr>
                                        <th scope="col" className="px-4 py-3 w-10">Comp</th>
                                        <th scope="col" className="px-4 py-3">Rank</th>
                                        <th scope="col" className="px-4 py-3">Status</th>
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
                                                <td className="px-4 py-3 font-mono font-bold text-slate-200">{sub.rank ? `#${sub.rank}` : '-'}</td>
                                                <td className="px-4 py-3">{renderStatusBadge(sub.status, sub.updated_at)}</td>
                                                <td className="px-6 py-3">
                                                    <div className="font-semibold text-white">{sub.candidate_name || 'Anonymous'}</div>
                                                    <div className="text-xs text-slate-500">{sub.candidate_email || 'No email provided'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded font-bold ${getScoreColor(sub.overall_score)}`}>
                                                        {sub.overall_score ? sub.overall_score.toFixed(1) : '-'}
                                                    </span>
                                                </td>

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
                                                        <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300"
                                                            onClick={() => setViewDetailsSubmissionId(sub.id)}
                                                            title="View Details"
                                                        >
                                                            Details
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
                )
            }

            {/* Create Campaign Modal */}
            <CreateCampaignModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                availableProblems={availableProblems}
                onSuccess={(campaign) => {
                    setCampaigns([campaign, ...campaigns]);
                    setIsCreateModalOpen(false);
                    if (!selectedCampaignId) setSelectedCampaignId(campaign.id);
                }}
            />

            {/* Compare Modal */}
            {
                showCompareModal && compareSelection.length === 2 && (() => {
                    const c1 = submissions.find(s => s.id === compareSelection[0])!;
                    const c2 = submissions.find(s => s.id === compareSelection[1])!;

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
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex flex-col items-center text-center">
                                            <div className="text-sm text-blue-400 font-medium mb-2 line-clamp-1">{c1.candidate_name || 'Candidate 1'}</div>
                                            <div className="mb-3">{renderStatusBadge(c1.status, c1.updated_at)}</div>
                                            <div className="text-3xl font-bold text-slate-100">{c1.overall_score ? c1.overall_score.toFixed(1) : '-'}</div>
                                            <div className="text-xs text-slate-500 mt-1">Overall Vector</div>
                                        </div>
                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex flex-col items-center text-center">
                                            <div className="text-sm text-purple-400 font-medium mb-2 line-clamp-1">{c2.candidate_name || 'Candidate 2'}</div>
                                            <div className="mb-3">{renderStatusBadge(c2.status, c2.updated_at)}</div>
                                            <div className="text-3xl font-bold text-slate-100">{c2.overall_score ? c2.overall_score.toFixed(1) : '-'}</div>
                                            <div className="text-xs text-slate-500 mt-1">Overall Vector</div>
                                        </div>
                                    </div>

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
                })()
            }

            {/* Transcript Viewer Modal */}
            {
                viewTranscriptSessionId && reportData && (
                    <CandidateTranscriptViewer
                        reportData={reportData}
                        candidateName={viewTranscriptCandidateName}
                        onClose={() => setViewTranscriptSessionId(null)}
                    />
                )
            }

            {/* Submission Details Side Panel */}
            {
                viewDetailsSubmissionId && (
                    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
                        {isLoadingReport || !reportData ? (
                            <div className="flex items-center justify-center flex-1">
                                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{reportData.candidate.name || 'Anonymous'}</h3>
                                        <p className="text-sm text-slate-400">{reportData.candidate.email || 'No email provided'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => window.print()} className="text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800">
                                            <Download className="w-4 h-4 mr-2" />
                                            Print / PDF
                                        </Button>
                                        <Button variant="ghost" onClick={() => setViewDetailsSubmissionId(null)} className="text-slate-400 hover:text-white">
                                            Close
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 report-print-area">
                                    {/* Summary section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</div>
                                            <div>{renderStatusBadge(
                                                submissions.find(s => s.id === viewDetailsSubmissionId)?.status || 'unknown',
                                                reportData.candidate.lastActiveAt
                                            )}</div>
                                        </div>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Overall Vector</div>
                                            <div className={`text-2xl font-bold ${getScoreColor(reportData.scores?.overall).split(' ')[0]}`}>
                                                {reportData.scores?.overall ? reportData.scores.overall.toFixed(1) : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timing section */}
                                    <div className="text-sm text-slate-400 space-y-2">
                                        <div className="flex justify-between">
                                            <span>Started:</span>
                                            <span className="text-slate-200">{new Date(reportData.candidate.startedAt).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Last Active:</span>
                                            <span className="text-slate-200">{new Date(reportData.candidate.lastActiveAt).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Radar Chart (if scores available) */}
                                    {reportData.scores && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                                <BarChart2 className="w-4 h-4 text-purple-400" /> Skill Breakdown
                                            </h4>
                                            <RadarChart
                                                currentData={reportData.scores}
                                                showAllTime={false}
                                                size="medium"
                                            />
                                        </div>
                                    )}

                                    {/* Overall Feedback */}
                                    {reportData.overallFeedback && (
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                            <h4 className="text-blue-400 font-bold mb-2">Overall Feedback</h4>
                                            <p className="text-slate-300 text-sm">{reportData.overallFeedback}</p>
                                        </div>
                                    )}

                                    {/* Questions Breakdown */}
                                    <div>
                                        <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4 text-blue-400" /> Question Breakdown
                                        </h4>
                                        <div className="space-y-4">
                                            {(reportData.questions || []).map((qs: any, index: number) => {
                                                return (
                                                    <div key={index} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="font-bold text-slate-200">{qs.title}</div>
                                                            <div className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                                                                {qs.status}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm text-slate-400 mb-3">
                                                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {qs.timeSpentMins} / {qs.timeLimitMins} mins</span>
                                                            <span>{qs.status === 'completed' && reportData.scores?.overall ? 'Scored' : 'Not scored'}</span>
                                                        </div>

                                                        {qs.status !== 'not_started' && qs.transcript && qs.transcript.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t border-slate-800">
                                                                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Transcript Preview</div>
                                                                <div className="bg-slate-900 rounded p-3 font-mono text-xs text-slate-300 max-h-32 overflow-hidden relative">
                                                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent"></div>
                                                                    {qs.transcript.map((t: any, i: number) => (
                                                                        <div key={i} className="mb-2">
                                                                            <strong className={t.speaker === 'user' ? 'text-blue-400' : 'text-purple-400'}>{t.speaker === 'user' ? reportData.candidate.name || 'Candidate' : 'AI'}:</strong> {t.text}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Full Transcript Viewer Button */}
                                    <div className="pt-4 border-t border-slate-800 pb-8">
                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                                            onClick={() => {
                                                const sub = submissions.find(s => s.id === viewDetailsSubmissionId);
                                                if (sub && sub.session_id) {
                                                    setViewTranscriptSessionId(sub.session_id);
                                                    setViewTranscriptCandidateName(sub.candidate_name || 'Anonymous');
                                                } else {
                                                    toast.info("No recorded assessment session ID available for the full viewer yet.");
                                                }
                                            }}
                                            disabled={!(submissions.find(s => s.id === viewDetailsSubmissionId)?.session_id)}
                                        >
                                            <MessageSquare className="w-4 h-4 mr-2" />
                                            Launch Full Transcript Viewer
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )
            }
        </div >
    );
}

// ProblemSearchSelect and ProblemPoolSelector removed as they are now in CreateCampaignModal.tsx

