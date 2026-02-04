import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, Lightbulb, Quote, HelpCircle } from 'lucide-react';
import { SkillDefinition } from '@/types/assessment';
import { SkillScore } from '@/lib/assessment/analyzer';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SkillDetailCardProps {
    definition: SkillDefinition;
    score: SkillScore;
}

export function SkillDetailCard({ definition, score }: SkillDetailCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Color mapping based on score
    const getScoreColor = (s: number) => {
        if (s >= 8) return 'text-emerald-400';
        if (s >= 5) return 'text-amber-400';
        return 'text-red-400';
    };

    const getProgressColor = (s: number) => {
        if (s >= 8) return 'bg-emerald-500';
        if (s >= 5) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="group bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-800/60 overflow-hidden transition-all duration-300 hover:border-slate-700/80 hover:shadow-2xl">
            <div
                className="p-5 cursor-pointer flex items-center justify-between"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="w-1.5 h-10 rounded-full"
                        style={{ backgroundColor: definition.color }}
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-white text-base">{definition.name}</h4>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger>
                                        <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-950 border-slate-800 text-slate-300 max-w-xs">
                                        {definition.description}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score.score * 10}%` }}
                                    className={cn("h-full transition-all duration-1000", getProgressColor(score.score))}
                                />
                            </div>
                            <span className={cn("text-sm font-black tabular-nums", getScoreColor(score.score))}>
                                {score.score}/10
                            </span>
                        </div>
                    </div>
                </div>

                <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    className="p-2 rounded-lg bg-slate-800/50 text-slate-400 group-hover:text-white"
                >
                    <ChevronDown className="w-5 h-5" />
                </motion.div>
            </div>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-slate-950/40 border-t border-slate-800/50"
                    >
                        <div className="p-6 space-y-6">

                            {/* Strengths & Improvements */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Strengths
                                    </div>
                                    <ul className="space-y-2">
                                        {score.strengths.map((s, i) => (
                                            <li key={i} className="text-sm text-slate-300 flex gap-2">
                                                <span className="text-emerald-500/50">•</span> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                        <Lightbulb className="w-3.5 h-3.5" /> Growth Path
                                    </div>
                                    <ul className="space-y-2">
                                        {score.improvements.map((s, i) => (
                                            <li key={i} className="text-sm text-slate-300 flex gap-2">
                                                <span className="text-amber-500/50">•</span> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Evidence Section */}
                            {score.evidence.length > 0 && (
                                <div className="pt-6 border-t border-slate-800/50">
                                    <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                        <Quote className="w-3.5 h-3.5" /> Evidence from Transcript
                                    </div>
                                    <div className="space-y-3">
                                        {score.evidence.map((snippet, i) => (
                                            <div key={i} className="bg-slate-900/60 p-3 rounded-xl border border-slate-800/30">
                                                <p className="text-xs text-slate-400 italic leading-relaxed">
                                                    "{snippet}"
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
