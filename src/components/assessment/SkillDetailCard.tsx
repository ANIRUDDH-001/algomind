/**
 * @codesage
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CheckCircle2, Lightbulb, Quote, HelpCircle } from 'lucide-react';
import { SkillDefinition } from '@/types/assessment';
import { SkillScore } from '@/lib/assessment/analyzer';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { COLORS } from '@/lib/design-tokens';

interface SkillDetailCardProps {
    skillId: string;
    definition: SkillDefinition;
    score: SkillScore;
}

export function SkillDetailCard({ skillId, definition, score }: SkillDetailCardProps) {
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
        <div className="group backdrop-blur-md rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.08)]"
            style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--surface-edge)',
                borderLeft: `3px solid ${(COLORS.skills as any)[skillId] || 'var(--accent-primary)'}`
            }}>
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
                                        <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)', color: 'var(--text-secondary)' }}>
                                        {definition.description}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                            <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
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
                    className="p-2 rounded-lg text-zinc-400 group-hover:text-white"
                    style={{ background: 'var(--surface-2)' }}
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
                        className="overflow-hidden bg-black/10"
                        style={{ borderTop: '1px solid var(--surface-edge)' }}
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
                                            <li key={i} className="text-sm text-zinc-300 flex gap-2">
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
                                            <li key={i} className="text-sm text-zinc-300 flex gap-2">
                                                <span className="text-amber-500/50">•</span> {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Evidence Section */}
                            {score.evidence.length > 0 && (
                                <div className="pt-6" style={{ borderTop: '1px solid var(--surface-edge)' }}>
                                    <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest mb-4">
                                        <Quote className="w-3.5 h-3.5" /> Evidence from Transcript
                                    </div>
                                    <div className="space-y-3">
                                        {score.evidence.map((snippet, i) => (
                                            <div key={i} className="p-3 rounded-xl" style={{ background: 'var(--surface-base)', border: '1px solid var(--surface-edge)' }}>
                                                <p className="text-xs text-zinc-400 italic leading-relaxed">
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
