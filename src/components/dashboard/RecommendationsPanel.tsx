'use client';

import React from 'react';
import { Recommendation } from '@/lib/recommendations/engine';
import { Lightbulb, ArrowRight, TrendingDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface RecommendationsPanelProps {
    recommendations: Recommendation[];
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
    if (recommendations.length === 0) return null;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {recommendations.map((rec, index) => (
                <div
                    key={rec.skillId}
                    className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300"
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
                        <div className="p-2 bg-slate-800/50 rounded-xl">
                            <Lightbulb className="w-4 h-4 text-amber-400" />
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 capitalize">
                        {rec.title}
                    </h3>
                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                        {rec.description}
                    </p>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Recommended Problems</p>
                        {rec.suggestedProblems.slice(0, 3).map(problem => (
                            <Link
                                key={problem.id}
                                href={`/interview?problem=${problem.id}`}
                                className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl hover:bg-slate-800 hover:border-slate-700 transition-all group/item"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        problem.difficulty === 'easy' ? "bg-emerald-500" :
                                            problem.difficulty === 'medium' ? "bg-blue-500" : "bg-red-500"
                                    )} />
                                    <span className="text-xs font-bold text-slate-300 group-hover/item:text-white transition-colors">{problem.title}</span>
                                </div>
                                <ArrowRight className="w-3 h-3 text-slate-600 group-hover/item:text-blue-400 transition-all transform group-hover/item:translate-x-1" />
                            </Link>
                        ))}
                    </div>

                    {/* Decorative Background Icon */}
                    <Target className="absolute -bottom-4 -right-4 w-24 h-24 text-slate-800 opacity-10 group-hover:scale-110 transition-transform duration-700 pointer-events-none" />
                </div>
            ))}
        </div>
    );
}
