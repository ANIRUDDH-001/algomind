'use client';

import React from 'react';
import { SessionHistory } from '@/types/assessment';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface SessionNodeProps {
    session: SessionHistory;
    isLatest?: boolean;
    onClick?: () => void;
}

export function SessionNode({ session, isLatest, onClick }: SessionNodeProps) {
    const score = session.overallScore;

    // Color based on score
    const colorClass =
        score >= 7.5 ? "bg-emerald-500 shadow-emerald-500/40" :
            score >= 5.5 ? "bg-blue-500 shadow-blue-500/40" :
                score >= 4.0 ? "bg-amber-500 shadow-amber-500/40" :
                    "bg-red-500 shadow-red-500/40";

    const ringClass =
        score >= 7.5 ? "ring-emerald-500/20" :
            score >= 5.5 ? "ring-blue-500/20" :
                score >= 4.0 ? "ring-amber-500/20" :
                    "ring-red-500/20";

    return (
        <div className="flex flex-col items-center gap-3 relative group shrink-0 w-28">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={onClick}
                            className={cn(
                                "w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center text-white font-black text-sm transition-all duration-300 relative z-10",
                                colorClass,
                                "shadow-[0_0_15px_rgba(0,0,0,0.3)] hover:scale-110 active:scale-95 ring-8",
                                ringClass,
                                isLatest && "animate-in zoom-in duration-500"
                            )}
                        >
                            {score.toFixed(1)}

                            {isLatest && (
                                <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-pulse border-2 border-slate-950 shadow-sm" />
                            )}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-slate-900 border-slate-800 text-slate-200">
                        <div className="space-y-1">
                            <p className="font-bold">{session.problemId.replace(/-/g, ' ')}</p>
                            <p className="text-[10px] text-slate-500">{format(new Date(session.timestamp), 'PPP p')}</p>
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="text-center space-y-1 w-full px-2">
                <p className="text-[10px] font-bold text-slate-400 truncate leading-tight transition-colors group-hover:text-white uppercase tracking-wider">
                    {session.problemId.replace(/-/g, ' ')}
                </p>
                <Badge variant="outline" className="text-[9px] px-1.5 h-4 border-slate-800 bg-slate-900/50 text-slate-500 font-medium">
                    {session.problemDifficulty || 'Medium'}
                </Badge>
            </div>
        </div>
    );
}
