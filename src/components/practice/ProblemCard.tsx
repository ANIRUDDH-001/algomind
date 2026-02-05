'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Play, CheckCircle, ExternalLink } from 'lucide-react';
import type { Problem } from '@/lib/supabase/problems';

interface ProblemCardProps {
    problem: Problem;
    attempted: boolean;
    onStart: (problemId: string) => void;
}

export function ProblemCard({ problem, attempted, onStart }: ProblemCardProps) {
    const [expanded, setExpanded] = useState(false);

    const difficultyStyles = {
        easy: 'bg-green-500/20 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        hard: 'bg-red-500/20 text-red-400 border-red-500/30',
    }[problem.difficulty];

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 hover:border-blue-500/50 transition-all duration-300 overflow-hidden">
            {/* Header - Always Visible */}
            <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-xl font-bold text-white">
                                {problem.title}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${difficultyStyles}`}>
                                {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                            </span>
                            {attempted && (
                                <span className="flex items-center gap-1 text-purple-400 text-sm font-medium">
                                    <CheckCircle className="w-4 h-4" />
                                    Attempted
                                </span>
                            )}
                        </div>

                        {/* Short Description */}
                        <p className="text-slate-400 text-sm mb-3 line-clamp-2">
                            {problem.description.split('\n\n')[0]}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2">
                            {problem.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-2 py-1 bg-slate-700/50 text-slate-300 rounded-lg text-xs font-medium border border-slate-600/50"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                        <Button
                            onClick={() => onStart(problem.id)}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-blue-900/20"
                        >
                            <Play className="w-4 h-4 mr-2" />
                            Start
                        </Button>
                        {problem.external_url && (
                            <a
                                href={problem.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-500 hover:text-blue-400 transition-colors uppercase tracking-widest"
                            >
                                <ExternalLink className="w-3 h-3" />
                                LeetCode/External
                            </a>
                        )}
                    </div>
                </div>

                {/* Toggle Details Button */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="w-4 h-4" />
                            Hide Details
                        </>
                    ) : (
                        <>
                            <ChevronDown className="w-4 h-4" />
                            Show Full Problem
                        </>
                    )}
                </button>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-slate-700/50 p-6 space-y-6 bg-slate-900/30">
                    {/* Full Description */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Problem Description</h4>
                        <div className="text-slate-300 text-sm whitespace-pre-line bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                            {problem.description}
                        </div>
                    </div>

                    {/* Examples */}
                    {problem.examples && problem.examples.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Examples</h4>
                            <div className="space-y-3">
                                {problem.examples.map((example, idx) => (
                                    <div key={idx} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                        <div className="mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Input:</span>
                                            <code className="block mt-1 text-sm text-blue-400 font-mono bg-slate-900/50 p-2 rounded-lg">
                                                {example.input}
                                            </code>
                                        </div>
                                        <div className="mb-3">
                                            <span className="text-xs font-bold text-slate-500 uppercase">Output:</span>
                                            <code className="block mt-1 text-sm text-green-400 font-mono bg-slate-900/50 p-2 rounded-lg">
                                                {example.output}
                                            </code>
                                        </div>
                                        {example.explanation && (
                                            <div>
                                                <span className="text-xs font-bold text-slate-500 uppercase">Explanation:</span>
                                                <p className="mt-1 text-sm text-slate-400">{example.explanation}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Hints */}
                    {problem.hints && problem.hints.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">💡 Hints</h4>
                            <ul className="space-y-2 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                                {problem.hints.map((hint, idx) => (
                                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                                        <span className="text-blue-400 font-bold shrink-0">{idx + 1}.</span>
                                        <span>{hint}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
