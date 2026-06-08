/**
 * @codesage
 * @file      src/components/enterprise/EmployerDashboard.tsx
 * @purpose   Main dashboard for employers to view campaigns and candidate submissions.
 * @tech      React, Tailwind CSS, Lucide, sonner
 * @connects  @/lib/api/adapters/employer-dashboard-adapter, @/components/enterprise/CohortStatsPanel
 * @apis      EmployerDashboardAdapter methods (getSubmissions, getSubmissionReport, etc.)
 * @db        None
 * @state     useState, useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * 
 * Summary:
 * This large component handles the primary employer view, switching between
 * campaign management and candidate submission reviews. It includes complex
 * sorting, filtering, and data export functionalities.
 */
// @ts-nocheck

'use client';

//  -- automated unused local suppression
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
//  -- automated unused local suppression
import { Input } from '@/components/ui/input';
import { Plus, Link as LinkIcon, Download, Trash2, Users, Clock, BarChart2, MessageSquare, Copy, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { RadarChart } from '@/components/charts/RadarChart';
import { useRouter } from 'next/navigation';
import { CandidateTranscriptViewer } from './CandidateTranscriptViewer';
import { CreateCampaignModal } from './CreateCampaignModal';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { CohortStatsPanel } from './CohortStatsPanel';
import { SwipeableCard } from '@/components/ui/swipeable-card';
//  -- automated unused local suppression
import { CampaignData as CampaignType, CampaignQuestion } from '@/types/campaign';
import { ApiClientError } from '@/lib/api/client';
import { EmployerDashboardAdapter } from '@/lib/api/adapters/employer-dashboard-adapter';

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
    analysis_status?: string | null;
    analysis_error?: string | null;

    // Joined from assessments
    hire_decision?: string | null;
    integrity_flags?: string[];
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
    //  -- automated unused local suppression
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
    const [viewDetailsSubmissionId, setViewDetailsSubmissionId] = useState<string | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    //  -- automated unused local suppression
    const [isCreating, setIsCreating] = useState(false);


    // Compare State
    const [compareSelection, setCompareSelection] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [openCardId, setOpenCardId] = useState<string | null>(null);

    // Sort State
    //  -- automated unused local suppression
    const [sortColumn, setSortColumn] = useState<string>('overall_score');
    //  -- automated unused local suppression
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Transcript Viewer State
    const [viewTranscriptSessionId, setViewTranscriptSessionId] = useState<string | null>(null);
    const [viewTranscriptCandidateName, setViewTranscriptCandidateName] = useState<string>('');
    //  -- automated unused local suppression
    const [viewTranscriptProblemTitle, setViewTranscriptProblemTitle] = useState<string>('');

    const handleAdapterError = (error: unknown) => {
        if (error instanceof ApiClientError && error.status === 401) {
            router.push('/login?reason=session_expired');
            return;
        }
        throw error;
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
            const data = await EmployerDashboardAdapter.getSubmissions<SubmissionData>(campaignId, statusFilter);
            setSubmissions(data.submissions || []);
            setSubmissionsSummary(data.summary || null);
        } catch (err) {
            try {
                handleAdapterError(err);
            } catch (error) {
                console.error('Failed to load submissions', error);
            }
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
            const data = await EmployerDashboardAdapter.getSubmissionReport(campaignId, submissionId);
            setReportData(data);
        } catch (err) {
            try {
                handleAdapterError(err);
            } catch (error) {
                console.error('Failed to load report', error);
                toast.error('Error loading report');
            }
            setViewDetailsSubmissionId(null);
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this campaign? Candidates will no longer be able to use its generic link.')) return;

        try {
            await EmployerDashboardAdapter.campaignDeactivate(id);
            setCampaigns(campaigns.map(c => c.id === id ? { ...c, is_active: false } : c));
            toast.success('Campaign deactivated');
        } catch (err) {
            try {
                handleAdapterError(err);
            } catch (error) {
                console.error('Failed to deactivate', error);
                toast.error('Failed to deactivate campaign');
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('PERMANENT DELETE: This will remove the campaign and ALL associated candidate submissions. This cannot be undone. Proceed?')) return;

        try {
            await EmployerDashboardAdapter.campaignDelete(id);
            setCampaigns(campaigns.filter(c => c.id !== id));
            toast.success('Campaign deleted permanently');
            if (selectedCampaignId === id) setSelectedCampaignId(null);
        } catch (err) {
            try {
                handleAdapterError(err);
            } catch (error) {
                console.error('Failed to delete', error);
                toast.error('Failed to delete campaign');
            }
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
            expired: 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
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
                    <p className="text-zinc-400">Manage technical assessments and review candidate performance.</p>
                </div>
                <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white"
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
                            <div className="col-span-full py-20 text-center text-zinc-500 bg-[var(--surface-1)] border border-white/8 rounded-xl">
                                <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <h3 className="text-lg text-zinc-300 font-medium">No Campaigns Yet</h3>
                                <p className="mt-2">Create your first technical assessment campaign to start screening candidates.</p>
                            </div>
                        ) : (
                            campaigns.map(campaign => {
                                const isExpired = campaign.expires_at && new Date(campaign.expires_at) < new Date();
                                const isMax = campaign.max_uses && campaign.uses_count >= campaign.max_uses;
                                const status = !campaign.is_active ? 'Deactivated' : (isExpired ? 'Expired' : (isMax ? 'Full' : 'Active'));
                                const statusColor = status === 'Active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-[var(--surface-2)] text-zinc-400 border-white/10';

                                const qCount = campaign.campaign_questions?.length || 1;
                                const totalTime = campaign.time_limit_mins;

                                let borderLeftClass = 'border-l-zinc-700';
                                if (status === 'Active') borderLeftClass = 'border-l-emerald-500';
                                else if (status === 'Full') borderLeftClass = 'border-l-amber-500';

                                return (
                                    <Card key={campaign.id} className={`flex flex-col hover:shadow-xl transition-all border-l-[3px] ${borderLeftClass}`} style={{ background: 'var(--surface-1)', borderTopColor: 'var(--surface-edge)', borderRightColor: 'var(--surface-edge)', borderBottomColor: 'var(--surface-edge)' }}>
                                        <div className="p-6 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="font-bold text-lg text-zinc-200 truncate pr-4" title={campaign.title}>
                                                    {campaign.title}
                                                </h3>
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                                                    {status}
                                                </span>
                                            </div>

                                            <div className="space-y-3 text-sm text-zinc-400 mb-6">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4" />
                                                    <span>{campaign.completed_count !== undefined ? campaign.completed_count : campaign.uses_count} completed</span>
                                                    <span className="text-zinc-500 text-[10px] ml-1">
                                                        ({campaign.uses_count} {campaign.max_uses ? `/ ${campaign.max_uses}` : ''} started)
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{qCount} {qCount === 1 ? 'question' : 'questions'} · {totalTime} mins total</span>
                                                </div>

                                                {/* Entry Code Section */}
                                                <div className="bg-[var(--surface-base)]/50 border border-white/10 rounded-lg p-2 flex items-center justify-between mt-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider leading-none mb-1">Entry Code</span>
                                                        <span className="font-mono text-white text-xs">{campaign.entry_code || '---'}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-blue-400"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(campaign.entry_code);
                                                            toast.success('Code copied!');
                                                        }}
                                                    >
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>

                                                <div className="text-xs text-zinc-500 pt-2">
                                                    Created {new Date(campaign.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-[var(--surface-base)] px-3 py-3 border-t border-white/8 grid grid-cols-2 gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-zinc-300 hover:text-white hover:bg-[var(--surface-2)] justify-start"
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
                                                <div className="flex items-center px-3 text-xs text-zinc-600 gap-2">
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
                        {/* Cohort Stats Panel */}
                        <CohortStatsPanel submissions={submissions} />
                        {/* ... (rest of submissions tab remains the same) */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-[var(--surface-1)] p-4 rounded-xl border border-white/8">
                            <div className="flex items-center gap-3">
                                <span className="text-zinc-400 text-sm">Campaign:</span>
                                <select
                                    className="bg-[var(--surface-base)] border border-white/8 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
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
                                <span className="text-sm text-zinc-500 italic">Select one more candidate to compare</span>
                            )}

                            {selectedCampaignId && (
                                <div className="ml-auto">
                                    <Button
                                        variant="outline"
                                        className="border-white/10 text-zinc-300 hover:text-white hover:bg-[var(--surface-2)]"
                                        onClick={async () => {
                                            try {
                                                const { blob, response } = await EmployerDashboardAdapter.exportSubmissions(selectedCampaignId);
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                // Try to get filename from content-disposition if possible
                                                const disp = response.headers.get('Content-Disposition');
                                                let filename = 'campaign-export.csv';
                                                if (disp) {
                                                    const match = disp.match(/filename="?([^"]+)"?/);
                                                    if (match && match[1]) filename = match[1];
                                                }
                                                a.download = filename;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                            } catch (e) {
                                                try {
                                                    handleAdapterError(e);
                                                } catch {
                                                    toast.error('Error downloading CSV');
                                                }
                                            }
                                        }}
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download CSV
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm border-b border-white/8 pb-4">
                            <button onClick={() => setStatusFilter('all')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'all' ? "bg-[var(--surface-2)] text-white" : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]/50")}>
                                All {submissionsSummary ? `(${submissionsSummary.total})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('completed')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'completed' ? "bg-[var(--surface-2)] text-white" : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]/50")}>
                                Completed {submissionsSummary ? `(${submissionsSummary.completed})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('in_progress')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'in_progress' ? "bg-[var(--surface-2)] text-white" : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]/50")}>
                                In Progress {submissionsSummary ? `(${submissionsSummary.in_progress})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('dropped_out')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'dropped_out' ? "bg-[var(--surface-2)] text-white" : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]/50")}>
                                Dropped Out {submissionsSummary ? `(${submissionsSummary.dropped_out})` : ''}
                            </button>
                            <button onClick={() => setStatusFilter('expired')} className={cn("px-3 py-1.5 rounded-md transition-colors", statusFilter === 'expired' ? "bg-[var(--surface-2)] text-white" : "text-zinc-400 hover:text-white hover:bg-[var(--surface-2)]/50")}>
                                Time Expired {submissionsSummary ? `(${submissionsSummary.expired})` : ''}
                            </button>
                        </div>

                        <div className="hidden md:block rounded-xl border-[var(--surface-edge)] overflow-hidden overflow-x-auto" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                            <table className="w-full text-sm text-left text-zinc-300 whitespace-nowrap">
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
                                        <th scope="col" className="px-3 py-3 text-center" title="Hire Decision">Decision</th>
                                        <th scope="col" className="px-3 py-3 text-center" title="Integrity Flags">Flags</th>
                                        <th scope="col" className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.length === 0 ? (
                                        <tr>
                                            <td colSpan={16} className="px-6 py-12 text-center text-zinc-500">
                                                {selectedCampaignId ? "No candidates have completed this assessment yet." : "Please select a campaign."}
                                            </td>
                                        </tr>
                                    ) : (
                                        //  -- automated unused local suppression
                                        submissions.map((sub, i) => (
                                            <tr key={sub.id} className="border-b border-white/10 hover:bg-[var(--surface-2)]/30 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={compareSelection.includes(sub.id)}
                                                        onChange={() => toggleCompareSubmission(sub.id)}
                                                        disabled={!compareSelection.includes(sub.id) && compareSelection.length >= 2}
                                                        className="w-4 h-4 text-blue-600 bg-[var(--surface-2)] border-white/10 rounded focus:ring-indigo-500 focus:ring-2 focus:ring-offset-slate-900"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold text-zinc-200">{sub.rank ? `#${sub.rank}` : '-'}</td>
                                                <td className="px-4 py-3">{renderStatusBadge(sub.status, sub.updated_at)}</td>
                                                <td className="px-6 py-3">
                                                    <div className="font-semibold text-white">{sub.candidate_name || 'Anonymous'}</div>
                                                    <div className="text-xs text-zinc-500">{sub.candidate_email || 'No email provided'}</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {sub.analysis_status === 'pending' && !sub.overall_score ? (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                                            Analyzing…
                                                        </span>
                                                    ) : sub.analysis_status === 'failed' ? (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20" title={sub.analysis_error || 'Analysis failed'}>
                                                            Failed
                                                        </span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded font-bold ${getScoreColor(sub.overall_score)}`}>
                                                            {sub.overall_score ? sub.overall_score.toFixed(1) : '—'}
                                                        </span>
                                                    )}
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

                                                {/* Hire Decision */}
                                                <td className="px-3 py-3 text-center">
                                                    {sub.hire_decision ? (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sub.hire_decision === 'STRONG_HIRE' || sub.hire_decision === 'HIRE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                                                                sub.hire_decision === 'BORDERLINE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                                                                    'bg-red-500/15 text-red-400 border border-red-500/25'
                                                            }`}>
                                                            {sub.hire_decision.replace('_', ' ')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-600">—</span>
                                                    )}
                                                </td>

                                                {/* Integrity Flags */}
                                                <td className="px-3 py-3 text-center">
                                                    {sub.integrity_flags && sub.integrity_flags.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1 justify-center">
                                                            {sub.integrity_flags.map((flag, fi) => (
                                                                <span key={fi} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25" data-testid="integrity-flag">
                                                                    🚩 {flag.replace(/_/g, ' ')}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600 text-xs">✓</span>
                                                    )}
                                                </td>

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

                        {/* Mobile List View with Swipeable Cards */}
                        <div className="md:hidden grid gap-4">
                            {submissions.length === 0 ? (
                                <div className="p-6 text-center text-zinc-500 bg-[var(--surface-1)] border border-white/8 rounded-xl">
                                    {selectedCampaignId ? "No candidates have completed this assessment yet." : "Please select a campaign."}
                                </div>
                            ) : (
                                submissions.map((sub) => (
                                    <SwipeableCard
                                        key={sub.id}
                                        isOpen={openCardId === sub.id}
                                        onOpenChange={(isOpen) => setOpenCardId(isOpen ? sub.id : null)}
                                        actionWidth={160}
                                        actions={
                                            <div className="flex h-full gap-2 py-1 items-stretch">
                                                <Button
                                                    className="h-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                                    onClick={() => setViewDetailsSubmissionId(sub.id)}
                                                >
                                                    Details
                                                </Button>
                                                <Button
                                                    className="h-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                                                    onClick={() => toggleCompareSubmission(sub.id)}
                                                >
                                                    {compareSelection.includes(sub.id) ? 'Uncompare' : 'Compare'}
                                                </Button>
                                            </div>
                                        }
                                    >
                                        <Card className="p-4 flex flex-col gap-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-semibold text-white">{sub.candidate_name || 'Anonymous'}</div>
                                                    <div className="text-xs text-zinc-500">{sub.candidate_email || 'No email provided'}</div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="font-mono font-bold text-zinc-200">{sub.rank ? `#${sub.rank}` : '-'}</div>
                                                    {sub.analysis_status === 'pending' && !sub.overall_score ? (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Analyzing…</span>
                                                    ) : sub.analysis_status === 'failed' ? (
                                                        <span className="px-2 py-1 rounded text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">Failed</span>
                                                    ) : (
                                                        <span className={`px-2 py-1 rounded font-bold text-xs ${getScoreColor(sub.overall_score)}`}>
                                                            {sub.overall_score ? sub.overall_score.toFixed(1) : '—'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {renderStatusBadge(sub.status, sub.updated_at)}
                                                {sub.hire_decision && (
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${sub.hire_decision === 'STRONG_HIRE' || sub.hire_decision === 'HIRE' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : sub.hire_decision === 'BORDERLINE' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'}`}>
                                                        {sub.hire_decision.replace('_', ' ')}
                                                    </span>
                                                )}
                                                {sub.integrity_flags && sub.integrity_flags.length > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                                                        🚩 {sub.integrity_flags.length} Flags
                                                    </span>
                                                )}
                                            </div>
                                        </Card>
                                    </SwipeableCard>
                                ))
                            )}
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
                        <ResponsiveModal
                            open={true}
                            onOpenChange={(open) => {
                                if (!open) setShowCompareModal(false);
                            }}
                            title={
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="w-5 h-5 text-purple-400" />
                                    Candidate Comparison
                                </div>
                            }
                            desktopClassName="max-w-4xl p-0"
                            className="bg-[var(--surface-1)] border-white/10 p-0"
                        >
                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex flex-col items-center text-center">
                                        <div className="text-sm text-blue-400 font-medium mb-2 line-clamp-1">{c1.candidate_name || 'Candidate 1'}</div>
                                        <div className="mb-3">{renderStatusBadge(c1.status, c1.updated_at)}</div>
                                        <div className="text-3xl font-bold text-zinc-100">{c1.overall_score ? c1.overall_score.toFixed(1) : '-'}</div>
                                        <div className="text-xs text-zinc-500 mt-1">Overall Vector</div>
                                    </div>
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 flex flex-col items-center text-center">
                                        <div className="text-sm text-purple-400 font-medium mb-2 line-clamp-1">{c2.candidate_name || 'Candidate 2'}</div>
                                        <div className="mb-3">{renderStatusBadge(c2.status, c2.updated_at)}</div>
                                        <div className="text-3xl font-bold text-zinc-100">{c2.overall_score ? c2.overall_score.toFixed(1) : '-'}</div>
                                        <div className="text-xs text-zinc-500 mt-1">Overall Vector</div>
                                    </div>
                                </div>

                                <div className="bg-[var(--surface-base)] rounded-xl p-4 border border-white/10 relative">
                                    <RadarChart
                                        currentData={scores1}
                                        previousScores={scores2}
                                        showComparison={true}
                                        showAllTime={false}
                                        size="large"
                                    />
                                    <div className="absolute top-4 right-4 flex flex-col gap-2 text-xs bg-[var(--surface-1)]/80 p-3 rounded-lg border border-white/8 backdrop-blur-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-blue-500 border border-[var(--surface-base)]"></div>
                                            <span className="text-zinc-200">{c1.candidate_name || 'Candidate 1'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-purple-500 border border-[var(--surface-base)]"></div>
                                            <span className="text-zinc-200">{c2.candidate_name || 'Candidate 2'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ResponsiveModal>
                    );
                })()
            }

            {/* Transcript Viewer Modal */}
            {
                viewTranscriptSessionId && reportData && (
                    <CandidateTranscriptViewer
                        reportData={reportData}
                        candidateName={viewTranscriptCandidateName}
                        onClose={() => {
                            setViewTranscriptSessionId(null);
                            setReportData(null);
                        }}
                    />
                )
            }

            {/* Submission Details Side Panel */}
            {
                viewDetailsSubmissionId && (
                    <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-[var(--surface-1)] border-l border-white/8 shadow-2xl z-50 flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
                        {isLoadingReport || !reportData ? (
                            <div className="flex items-center justify-center flex-1">
                                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-white/8 flex justify-between items-start bg-[var(--surface-1)]">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{reportData.candidate.name || 'Anonymous'}</h3>
                                        <p className="text-sm text-zinc-400">{reportData.candidate.email || 'No email provided'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => window.print()} className="text-zinc-300 border-white/10 hover:text-white hover:bg-[var(--surface-2)]">
                                            <Download className="w-4 h-4 mr-2" />
                                            Print / PDF
                                        </Button>
                                        <Button variant="ghost" onClick={() => setViewDetailsSubmissionId(null)} className="text-zinc-400 hover:text-white">
                                            Close
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 report-print-area">
                                    {/* Summary section */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[var(--surface-base)] p-4 rounded-xl border border-white/8">
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</div>
                                            <div>{renderStatusBadge(
                                                submissions.find(s => s.id === viewDetailsSubmissionId)?.status || 'unknown',
                                                reportData.candidate.lastActiveAt
                                            )}</div>
                                        </div>
                                        <div className="bg-[var(--surface-base)] p-4 rounded-xl border border-white/8">
                                            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Overall Vector</div>
                                            <div className={`text-2xl font-bold ${getScoreColor(reportData.scores?.overall).split(' ')[0]}`}>
                                                {reportData.scores?.overall ? reportData.scores.overall.toFixed(1) : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Timing section */}
                                    <div className="text-sm text-zinc-400 space-y-2">
                                        <div className="flex justify-between">
                                            <span>Started:</span>
                                            <span className="text-zinc-200">{new Date(reportData.candidate.startedAt).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Last Active:</span>
                                            <span className="text-zinc-200">{new Date(reportData.candidate.lastActiveAt).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Radar Chart (if scores available) */}
                                    {reportData.scores && (
                                        <div className="bg-[var(--surface-base)] p-4 rounded-xl border border-white/8">
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
                                            <p className="text-zinc-300 text-sm">{reportData.overallFeedback}</p>
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
                                                    <div key={index} className="bg-[var(--surface-base)] border border-white/8 rounded-xl p-4">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <div className="font-bold text-zinc-200">{qs.title}</div>
                                                            <div className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--surface-2)] text-zinc-400 uppercase">
                                                                {qs.status}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm text-zinc-400 mb-3">
                                                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {qs.timeSpentMins} / {qs.timeLimitMins} mins</span>
                                                            <span>{qs.status === 'completed' && reportData.scores?.overall ? 'Scored' : 'Not scored'}</span>
                                                        </div>

                                                        {qs.status !== 'not_started' && qs.transcript && qs.transcript.length > 0 && (
                                                            <div className="mt-4 pt-4 border-t border-white/8">
                                                                <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wide">Transcript Preview</div>
                                                                <div className="bg-[var(--surface-1)] rounded p-3 font-mono text-xs text-zinc-300 max-h-32 overflow-hidden relative">
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
                                    <div className="pt-4 border-t border-white/8 pb-8">
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

