'use client';

import React from 'react';
import { Users, TrendingUp, Award, AlertTriangle } from 'lucide-react';

interface SubmissionData {
    candidate_name: string;
    overall_score: number;
    hire_decision?: string | null;
    dimension_scores?: Record<string, number>;
    integrity_flags?: string[];
}

interface CampaignStats {
    totalCandidates: number;
    completedCount: number;
    avgOverallScore: number;
    scoreDistribution: { range: string; count: number }[];
    avgByDimension: Record<string, number>;
    hireDecisionCounts: Record<string, number>;
    topCandidate: { name: string; score: number } | null;
}

interface CohortStatsPanelProps {
    submissions: SubmissionData[];
}

const DIMENSION_LABELS: Record<string, string> = {
    'problem_decomposition': 'Decomp',
    'pattern_recognition': 'Pattern',
    'algorithmic_thinking': 'Algo',
    'complexity_analysis': 'Cmplx',
    'communication_clarity': 'Comm',
    'edge_case_awareness': 'Edge',
    'optimization_mindset': 'Optim',
    'debugging_approach': 'Debug',
};

const HIRE_COLORS: Record<string, string> = {
    'STRONG_HIRE': '#10b981',
    'HIRE': '#34d399',
    'BORDERLINE': '#f59e0b',
    'NO_HIRE': '#ef4444',
    'STRONG_NO_HIRE': '#dc2626',
};

const HIRE_SHORT_LABELS: Record<string, string> = {
    'STRONG_HIRE': 'S.Hire',
    'HIRE': 'Hire',
    'BORDERLINE': 'Border',
    'NO_HIRE': 'No Hire',
    'STRONG_NO_HIRE': 'S.No',
};

function computeStats(submissions: SubmissionData[]): CampaignStats {
    const completed = submissions.filter(s => s.overall_score > 0);
    const scores = completed.map(s => s.overall_score);

    const avgOverall = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Score distribution
    const buckets = [
        { range: '0-4', min: 0, max: 4 },
        { range: '4-6', min: 4, max: 6 },
        { range: '6-8', min: 6, max: 8 },
        { range: '8-10', min: 8, max: 10.01 },
    ];
    const scoreDistribution = buckets.map(b => ({
        range: b.range,
        count: scores.filter(s => s >= b.min && s < b.max).length,
    }));

    // Average by dimension
    const avgByDimension: Record<string, number> = {};
    const dims = Object.keys(DIMENSION_LABELS);
    for (const dim of dims) {
        const dimScores = completed
            .map(s => (s.dimension_scores?.[dim] ?? (s as any)[dim]) || 0)
            .filter(v => v > 0);
        avgByDimension[dim] = dimScores.length > 0
            ? dimScores.reduce((a, b) => a + b, 0) / dimScores.length
            : 0;
    }

    // Hire decision counts
    const hireDecisionCounts: Record<string, number> = {};
    for (const s of completed) {
        if (s.hire_decision) {
            hireDecisionCounts[s.hire_decision] = (hireDecisionCounts[s.hire_decision] || 0) + 1;
        }
    }

    // Top candidate
    const sorted = [...completed].sort((a, b) => b.overall_score - a.overall_score);
    const topCandidate = sorted[0]
        ? { name: sorted[0].candidate_name || 'Anonymous', score: sorted[0].overall_score }
        : null;

    return {
        totalCandidates: submissions.length,
        completedCount: completed.length,
        avgOverallScore: avgOverall,
        scoreDistribution,
        avgByDimension,
        hireDecisionCounts,
        topCandidate,
    };
}

export function CohortStatsPanel({ submissions }: CohortStatsPanelProps) {
    if (submissions.length < 3) return null;

    const stats = computeStats(submissions);
    const maxBucketCount = Math.max(...stats.scoreDistribution.map(b => b.count), 1);

    const hireTotal = Object.values(stats.hireDecisionCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="space-y-6 mb-8" data-testid="cohort-stats-panel">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total</span>
                    </div>
                    <span className="text-2xl font-black text-white">{stats.totalCandidates}</span>
                    <span className="text-xs text-zinc-500 ml-2">({stats.completedCount} completed)</span>
                </div>

                <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Avg Score</span>
                    </div>
                    <span className="text-2xl font-black text-white">{stats.avgOverallScore.toFixed(1)}</span>
                    <span className="text-xs text-zinc-500 ml-1">/10</span>
                </div>

                {stats.topCandidate && (
                    <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Award className="w-4 h-4 text-amber-400" />
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Top</span>
                        </div>
                        <span className="text-sm font-bold text-white truncate block">{stats.topCandidate.name}</span>
                        <span className="text-xs text-emerald-400">{stats.topCandidate.score.toFixed(1)}/10</span>
                    </div>
                )}

                <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Decisions</span>
                    </div>
                    <span className="text-2xl font-black text-white">{hireTotal}</span>
                    <span className="text-xs text-zinc-500 ml-2">hire signals</span>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Score Distribution Bar Chart */}
                <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                    <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Score Distribution</h4>
                    <div className="flex items-end gap-3 h-24">
                        {stats.scoreDistribution.map(bucket => {
                            const height = maxBucketCount > 0 ? (bucket.count / maxBucketCount) * 100 : 0;
                            const color = bucket.range === '0-4' ? '#ef4444'
                                : bucket.range === '4-6' ? '#f59e0b'
                                    : bucket.range === '6-8' ? '#10b981'
                                        : '#6366f1';
                            return (
                                <div key={bucket.range} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-bold text-white">{bucket.count}</span>
                                    <div
                                        className="w-full rounded-t-md transition-all duration-500"
                                        style={{ height: `${Math.max(height, 4)}%`, background: color + '80' }}
                                    />
                                    <span className="text-[9px] text-zinc-500">{bucket.range}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Hire Decision Donut */}
                {hireTotal > 0 && (
                    <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4" data-testid="hire-donut">
                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Hire Decisions</h4>
                        <div className="flex flex-wrap gap-3">
                            {Object.entries(stats.hireDecisionCounts).map(([decision, count]) => {
                                const pct = hireTotal > 0 ? ((count / hireTotal) * 100).toFixed(0) : '0';
                                return (
                                    <div key={decision} className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 rounded-full"
                                            style={{ background: HIRE_COLORS[decision] || '#6b7280' }}
                                        />
                                        <span className="text-xs text-zinc-300">
                                            {HIRE_SHORT_LABELS[decision] || decision}
                                        </span>
                                        <span className="text-xs font-bold text-zinc-400">{count} ({pct}%)</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Dimension Averages */}
            <div className="bg-[var(--surface-1)]/60 border border-white/8 rounded-xl p-4">
                <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4">Average by Dimension (Cohort)</h4>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                    {Object.entries(DIMENSION_LABELS).map(([dim, label]) => {
                        const avg = stats.avgByDimension[dim] || 0;
                        const color = avg >= 7 ? 'text-emerald-400' : avg >= 4 ? 'text-amber-400' : 'text-red-400';
                        return (
                            <div key={dim} className="text-center">
                                <div className={`text-lg font-black ${color}`}>{avg > 0 ? avg.toFixed(1) : '—'}</div>
                                <div className="text-[9px] text-zinc-500 font-bold">{label}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
