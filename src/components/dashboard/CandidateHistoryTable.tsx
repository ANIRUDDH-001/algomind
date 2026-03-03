'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BarChart2, Play, AlertCircle, TrendingUp, Sparkles, Brain } from 'lucide-react';
import { RadarChart } from '@/components/charts/RadarChart';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface Submission {
    id: string;
    status: string;
    overall_score: number | null;
    created_at: string;
    assessment_campaigns?: {
        title: string;
        time_limit_mins: number;
        public_token: string;
        show_score_to_candidate?: boolean;
    };
}

export function CandidateHistoryTable({ submissions }: { submissions: Submission[] }) {
    const router = useRouter();
    const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
    const [reportData, setReportData] = useState<any>(null);
    const [isLoadingReport, setIsLoadingReport] = useState(false);

    useEffect(() => {
        const loadReport = async () => {
            if (!viewDetailsId) return;
            setIsLoadingReport(true);
            try {
                const res = await fetch(`/api/user/submissions/${viewDetailsId}/report`);
                if (res.ok) {
                    const data = await res.json();
                    setReportData(data);
                } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to load report');
                    setViewDetailsId(null);
                }
            } catch (error) {
                console.error('Report fetch error:', error);
                toast.error('Error fetching report');
                setViewDetailsId(null);
            } finally {
                setIsLoadingReport(false);
            }
        };
        loadReport();
    }, [viewDetailsId]);

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <span className="px-2 py-1 rounded bg-green-500/10 text-green-400 font-bold border border-green-500/20 text-[10px] uppercase">Completed</span>;
            case 'in_progress': return <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 text-[10px] uppercase">In Progress</span>;
            case 'dropped_out': return <span className="px-2 py-1 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20 text-[10px] uppercase">Dropped Out</span>;
            case 'expired': return <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 font-bold border border-orange-500/20 text-[10px] uppercase">Time Expired</span>;
            default: return <span className="px-2 py-1 rounded bg-slate-800 text-slate-400 font-bold border border-slate-700 text-[10px] uppercase">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 flex flex-col hover:border-blue-500/30 transition-all">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-300 whitespace-nowrap">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th scope="col" className="px-6 py-4">Campaign</th>
                                <th scope="col" className="px-6 py-4">Status</th>
                                <th scope="col" className="px-6 py-4 text-center">Score</th>
                                <th scope="col" className="px-6 py-4">Date</th>
                                <th scope="col" className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <AlertCircle className="w-8 h-8 opacity-50 mb-2" />
                                            <p>No assessment history found.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                submissions.map((sub) => {
                                    const campaign = Array.isArray(sub.assessment_campaigns) ? sub.assessment_campaigns[0] : sub.assessment_campaigns;

                                    return (
                                        <tr key={sub.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-bold text-white">
                                                {campaign?.title || 'Assessment'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {renderStatusBadge(sub.status)}
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono font-bold text-slate-200 text-lg">
                                                {(campaign?.show_score_to_candidate && sub.overall_score !== null)
                                                    ? sub.overall_score.toFixed(1)
                                                    : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-xs">
                                                {sub.created_at ? format(new Date(sub.created_at), 'MMM dd, yyyy') : 'No Date'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    {sub.status === 'in_progress' && campaign?.public_token && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold tracking-tight shadow-lg shadow-blue-500/20"
                                                            onClick={() => router.push(`/assess/${campaign.public_token}`)}
                                                        >
                                                            Resume <Play className="w-3.5 h-3.5 ml-1.5" />
                                                        </Button>
                                                    )}
                                                    {(sub.status === 'completed' || sub.status === 'expired') && campaign?.show_score_to_candidate && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 shadow-lg"
                                                            onClick={() => setViewDetailsId(sub.id)}
                                                        >
                                                            <BarChart2 className="w-4 h-4 mr-2" />
                                                            View Results
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Candidate Details Side Panel/Modal Overlay */}
            {viewDetailsId && (
                <div className="fixed inset-0 z-[150] flex items-center justify-end bg-black/60 backdrop-blur-sm pointer-events-auto">
                    <div className="w-full md:w-[600px] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-300 relative">
                        {isLoadingReport || !reportData ? (
                            <div className="flex items-center justify-center flex-1">
                                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                <div className="p-6 border-b border-slate-800 flex justify-between items-start bg-slate-900 sticky top-0 z-10">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">Assessment Performance</h3>
                                        <p className="text-sm text-slate-400">{reportData.campaign.title}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="ghost" onClick={() => setViewDetailsId(null)} className="text-slate-400 hover:text-white">
                                            Close
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 space-y-8 report-print-area">
                                    {/* Overall Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Overall Score</div>
                                            <div className="text-3xl font-black text-white">
                                                {reportData.scores?.overall ? reportData.scores.overall.toFixed(1) : 'N/A'}
                                            </div>
                                        </div>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col justify-center">
                                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-bold flex items-center gap-1.5"><Brain className="w-3.5 h-3.5" /> Status</div>
                                            <div>{renderStatusBadge(
                                                submissions.find(s => s.id === viewDetailsId)?.status || 'unknown'
                                            )}</div>
                                        </div>
                                    </div>

                                    {/* Radar Chart */}
                                    {reportData.scores && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <h4 className="text-white font-bold mb-4 flex items-center gap-2 uppercase tracking-tight text-sm">
                                                <BarChart2 className="w-4 h-4 text-purple-400" /> Skill Breakdown
                                            </h4>
                                            <RadarChart
                                                currentScores={reportData.scores}
                                                showAllTime={false}
                                                size="medium"
                                            />
                                        </div>
                                    )}

                                    {/* Question Breakdown */}
                                    {reportData.questions && reportData.questions.length > 0 && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <h4 className="text-white font-bold mb-4 uppercase tracking-tight text-sm flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-blue-400" /> Topic Summary
                                            </h4>
                                            <div className="space-y-4">
                                                {reportData.questions.map((q: any, i: number) => (
                                                    <div key={i} className="flex flex-col gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-800/50">
                                                        <div className="flex justify-between items-center">
                                                            <span className="font-bold text-slate-200 text-sm truncate max-w-[200px]" title={q.title}>{i + 1}. {q.title}</span>
                                                            {renderStatusBadge(q.status)}
                                                        </div>
                                                        <div className="flex justify-between text-xs text-slate-500">
                                                            <span className="capitalize">Difficulty: {q.difficulty}</span>
                                                            <span>{q.timeSpentMins} / {q.timeLimitMins} mins</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Next Steps */}
                                    {reportData.nextSteps && reportData.nextSteps.length > 0 && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <h4 className="text-white font-bold mb-3 uppercase tracking-tight text-sm">Actionable Feedback</h4>
                                            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
                                                {reportData.nextSteps.map((step: string, i: number) => (
                                                    <li key={i}>{step}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
