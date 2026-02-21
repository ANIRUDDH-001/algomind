'use client';

import React, { useEffect, useState } from 'react';
import { getInsightSnapshot, InsightSnapshot } from '@/lib/recommendations/insight-engine';
import { Lightbulb, ArrowRight, Target, Dumbbell, Play, ExternalLink, Activity, Sparkles, TrendingDown, Clock, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface InsightsPanelProps {
    userId: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
    reinforce_leetcode: <Sparkles className="w-4 h-4 text-amber-400" />,
    declining_trend: <TrendingDown className="w-4 h-4 text-red-400" />,
    unexplored_pattern: <Map className="w-4 h-4 text-emerald-400" />,
    momentum: <Activity className="w-4 h-4 text-blue-400" />,
    streak_at_risk: <Clock className="w-4 h-4 text-orange-400" />,
};

export function InsightsPanel({ userId }: InsightsPanelProps) {
    const [snapshot, setSnapshot] = useState<InsightSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchInsights() {
            try {
                const data = await getInsightSnapshot(userId);
                setSnapshot(data);
            } catch (err) {
                console.error('Failed to load insights:', err);
            } finally {
                setIsLoading(false);
            }
        }
        fetchInsights();
    }, [userId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Dumbbell className="w-8 h-8 text-slate-800 animate-pulse" />
            </div>
        );
    }

    if (!snapshot) {
        return (
            <div className="p-12 border border-dashed border-slate-800 rounded-3xl text-center bg-slate-900/20" data-tour="insights">
                <Lightbulb className="w-8 h-8 text-slate-600 mx-auto mb-4" />
                <h3 className="text-slate-400 font-bold mb-1">Complete your first interview</h3>
                <p className="text-slate-500 text-sm">Personalized insights will unlock here once we evaluate your cognitive profile.</p>
            </div>
        );
    }

    const { insights, recommendedProblems, recommendedTier, tierReasoning, computedAt, sessionsSnapshot } = snapshot;

    // Show warning if computed > 25 hours ago
    const isStale = (Date.now() - new Date(computedAt).getTime()) > 25 * 3600 * 1000;

    return (
        <div className="space-y-8" data-tour="insights">
            {isStale && (
                <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400/90 text-xs font-bold uppercase tracking-widest rounded-xl flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" />
                    Crunching your latest data... (Insights updating soon)
                </div>
            )}

            {/* INSIGHT CARDS */}
            {insights.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {insights.map((card, idx) => (
                        <div
                            key={idx}
                            className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 h-full flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "uppercase text-[10px] font-black tracking-widest px-2",
                                        card.priority === 'high' ? "border-red-500/50 text-red-500 bg-red-500/5" :
                                            card.priority === 'medium' ? "border-blue-500/50 text-blue-500 bg-blue-500/5" :
                                                "border-slate-500/50 text-slate-400 bg-slate-500/5"
                                    )}
                                >
                                    {card.priority} Priority
                                </Badge>
                                <div className="p-2 bg-slate-800/50 rounded-xl">
                                    {TYPE_ICONS[card.type] || <Lightbulb className="w-4 h-4 text-amber-400" />}
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                                {card.title}
                            </h3>
                            <p className="text-xs text-slate-500 mb-6 leading-relaxed flex-1">
                                {card.body}
                            </p>

                            {card.problemSuggestions && card.problemSuggestions.length > 0 && (
                                <div className="space-y-2 mt-auto">
                                    {card.problemSuggestions.map(prob => (
                                        <div key={prob.id} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full",
                                                    prob.difficulty === 'easy' ? "bg-emerald-500" :
                                                        prob.difficulty === 'medium' ? "bg-blue-500" : "bg-red-500"
                                                )} />
                                                <span className="text-xs font-bold text-slate-300">{prob.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {prob.leetcodeUrl && (
                                                    <a href={prob.leetcodeUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-blue-400" title="View on LeetCode">
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                <Link href={`/interview?problemId=${prob.id}`} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors text-slate-500 hover:text-purple-400" title="Mock Interview">
                                                    <Play className="w-3.5 h-3.5" />
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Target className="absolute -bottom-4 -right-4 w-24 h-24 text-slate-800 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                        </div>
                    ))}
                </div>
            )}

            {/* RECOMMENDED PROBLEMS COLLECTION */}
            {recommendedProblems.length > 0 && (
                <div className="mt-12 space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Recommended for you</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommendedProblems.map(prob => (
                            <Link key={prob.id} href={`/interview?problemId=${prob.id}`} className="block group">
                                <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl hover:border-blue-500/30 transition-all h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={cn(
                                            "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                                            prob.difficulty === 'easy' ? "bg-emerald-500/10 text-emerald-400" :
                                                prob.difficulty === 'medium' ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"
                                        )}>
                                            {prob.difficulty}
                                        </div>
                                        {prob.leetcodeUrl && (
                                            <span className="text-[9px] font-bold bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">LC</span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-slate-200 mb-1">{prob.title}</h4>
                                    <div className="flex flex-wrap gap-1 mt-auto pt-3">
                                        {prob.patternTags?.slice(0, 2).map((tag, idx) => (
                                            <span key={idx} className="text-[10px] bg-slate-950/50 text-slate-500 px-1.5 py-0.5 rounded border border-slate-800/50">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* TIER REASONING STRIP */}
            <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h4 className="text-white font-bold text-sm">Target Tier {recommendedTier}</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">{tierReasoning}</p>
                </div>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-right shrink-0">
                    Based on {sessionsSnapshot} session{sessionsSnapshot !== 1 ? 's' : ''}
                </div>
            </div>
        </div>
    );
}
