'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Link as LinkIcon, Download, Trash2, Users, Clock, AlertCircle, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RadarChart } from '@/components/charts/RadarChart';

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
    created_at: string;
}

interface SubmissionData {
    id: string;
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

    // Submissions State
    const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
    const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

    // Create Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaign, setNewCampaign] = useState({
        title: '',
        problemId: availableProblems[0]?.id || '',
        timeLimit: '45',
        maxUses: '',
        expiresAt: '',
        showScoreToCandidate: false
    });
    const [isCreating, setIsCreating] = useState(false);

    // Compare State
    const [compareSelection, setCompareSelection] = useState<string[]>([]);
    const [showCompareModal, setShowCompareModal] = useState(false);

    // Fetch Submissions when tab changes or campaign changes
    useEffect(() => {
        if (activeTab === 'submissions' && selectedCampaignId) {
            loadSubmissions(selectedCampaignId);
        }
    }, [activeTab, selectedCampaignId]);

    const loadSubmissions = async (campaignId: string) => {
        setIsLoadingSubmissions(true);
        try {
            const res = await fetch(`/api/employer/submissions/${campaignId}`);
            if (res.ok) {
                const data = await res.json();
                setSubmissions(data.submissions || []);
            }
        } catch (err) {
            console.error('Failed to load submissions', err);
        } finally {
            setIsLoadingSubmissions(true);
        }
    };

    const handleCreateCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const res = await fetch('/api/employer/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newCampaign.title,
                    problemId: newCampaign.problemId,
                    timeLimitMins: parseInt(newCampaign.timeLimit),
                    maxUses: newCampaign.maxUses ? parseInt(newCampaign.maxUses) : undefined,
                    expiresAt: newCampaign.expiresAt ? new Date(newCampaign.expiresAt).toISOString() : undefined
                })
            });

            if (!res.ok) throw new Error("Failed to create campaign");

            const data = await res.json();
            setCampaigns([data.campaign, ...campaigns]);
            setIsCreateModalOpen(false);
            setNewCampaign({
                title: '', problemId: availableProblems[0]?.id || '', timeLimit: '45', maxUses: '', expiresAt: '', showScoreToCandidate: false
            });

            if (!selectedCampaignId) {
                setSelectedCampaignId(data.campaign.id);
            }
        } catch (error) {
            console.error(error);
            alert("Failed to create campaign");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        if (!confirm('Are you sure you want to deactivate this campaign? Candidates will no longer be able to use its generic link.')) return;

        try {
            const res = await fetch(`/api/employer/campaigns/${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                setCampaigns(campaigns.map(c => c.id === id ? { ...c, is_active: false } : c));
            }
        } catch (err) {
            console.error('Failed to deactivate', err);
        }
    };

    const copyLink = (token: string) => {
        const url = `${window.location.origin}/assess/${token}`;
        navigator.clipboard.writeText(url);
        alert('Assessment link copied to clipboard!');
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

                <div className="ml-auto pb-2 pl-4">
                    <Button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        New Campaign
                    </Button>
                </div>
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
                                                <span>{campaign.uses_count} {campaign.max_uses ? `/ ${campaign.max_uses}` : ''} responses</span>
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
                                                <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300"
                                                    onClick={() => alert('PDF Downloads interface via PDFReport coming soon in upcoming modules.')}
                                                >
                                                    <Download className="w-4 h-4" />
                                                </Button>
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
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="bg-slate-900 border-slate-700 w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-xl font-bold text-white">Create New Campaign</h3>
                        </div>
                        <form onSubmit={handleCreateCampaign} className="p-6 space-y-4">
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
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Assessment Problem *</label>
                                <select
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={newCampaign.problemId}
                                    onChange={e => setNewCampaign({ ...newCampaign, problemId: e.target.value })}
                                >
                                    {availableProblems.map(p => (
                                        <option key={p.id} value={p.id}>
                                            [{p.difficulty.toUpperCase()}] {p.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Time Limit *</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newCampaign.timeLimit}
                                        onChange={e => setNewCampaign({ ...newCampaign, timeLimit: e.target.value })}
                                    >
                                        <option value="30">30 minutes</option>
                                        <option value="45">45 minutes</option>
                                        <option value="60">60 minutes</option>
                                        <option value="90">90 minutes</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Max Responses</label>
                                    <Input
                                        type="number"
                                        placeholder="Optional"
                                        min="1"
                                        value={newCampaign.maxUses}
                                        onChange={e => setNewCampaign({ ...newCampaign, maxUses: e.target.value })}
                                        className="bg-slate-950 border-slate-800"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Expiration Date</label>
                                <Input
                                    type="datetime-local"
                                    value={newCampaign.expiresAt}
                                    onChange={e => setNewCampaign({ ...newCampaign, expiresAt: e.target.value })}
                                    className="bg-slate-950 border-slate-800 [color-scheme:dark]"
                                />
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
        </div>
    );
}
