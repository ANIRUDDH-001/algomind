/**
 * @codesage
 */
// @ts-nocheck

'use client';

//  -- automated unused local suppression
import React from 'react';
import { Recommendation } from '@/lib/recommendations/engine';
import { Lightbulb, ArrowRight, Target, Dumbbell, Play, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface RecommendationsPanelProps {
    recommendations: Recommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
    if (recommendations.length === 0) return (
        <div className="p-12 border border-dashed border-white/8 rounded-3xl text-center bg-[var(--surface-1)]/20" data-tour="recommendations">
            <Dumbbell className="w-8 h-8 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-zinc-400 font-bold mb-1">No specific recommendations yet</h3>
            <p className="text-zinc-500 text-sm">Complete more sessions to get personalized problem suggestions!</p>
        </div>
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full" data-tour="recommendations">
            {recommendations.map((rec) => (
                <div
                    key={rec.skillId}
                    className="bg-[var(--surface-1)]/40 border border-white/8 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300 h-full flex flex-col"
                >
                    {/* Priority Badge */}
                    <div className="flex justify-between items-start mb-4">
                        <Badge
                            variant="outline"
                            className={cn(
                                "uppercase text-[10px] font-black tracking-widest px-2",
                                rec.priority === 'high' ? "border-red-500/50 text-red-500 bg-red-500/5" : "border-blue-500/50 text-blue-500 bg-blue-500/5"
                            )}
                        >
                            {rec.priority} Priority
                        </Badge>
                        <div className="p-2 bg-[var(--surface-2)]/50 rounded-xl">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 capitalize">
                        {rec.title}
                    </h3>
                    <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                        {rec.description}
                    </p>

                    <div className="space-y-3 mt-auto">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Recommended Problems</p>
                        {rec.suggestedProblems.length > 0 ? (
                            rec.suggestedProblems.map(problem => (
                                <div key={problem.id} className="space-y-2">
                                    <div className="flex items-center justify-between p-3 bg-[var(--surface-base)]/50 border border-white/8/80 rounded-2xl group/item">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                problem.difficulty === 'easy' ? "bg-emerald-500" :
                                                    problem.difficulty === 'medium' ? "bg-blue-500" : "bg-red-500"
                                            )} />
                                            <span className="text-xs font-bold text-zinc-300">{problem.title}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {problem.external_url && (
                                                <a
                                                    href={problem.external_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-zinc-500 hover:text-blue-400"
                                                    title="Practice on LeetCode"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            <Link
                                                href={`/interview?problemId=${problem.id}`}
                                                className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-zinc-500 hover:text-purple-400"
                                                title="Start AI Mock Interview"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <Link
                                href="/interview"
                                className="flex items-center justify-between p-3 bg-[var(--surface-base)]/50 border border-white/8/80 rounded-2xl hover:bg-[var(--surface-2)] transition-all text-xs font-bold text-zinc-400"
                            >
                                Start another interview
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        )}
                    </div>

                    {/* Decorative Background Icon */}
                    <Target className="absolute -bottom-4 -right-4 w-24 h-24 text-zinc-800 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                </div>
            ))}
        </div>
    );
}
