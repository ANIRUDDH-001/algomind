'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface RadarChartLegendProps {
    showCurrent?: boolean;
    showPrevious?: boolean;
    onToggle?: (type: 'current' | 'previous') => void;
    currentLabel?: string;
    previousLabel?: string;
}

export function RadarChartLegend({
    showCurrent = true,
    showPrevious = false,
    onToggle,
    currentLabel = "Current Session",
    previousLabel = "Previous Session"
}: RadarChartLegendProps) {
    return (
        <div className="flex items-center justify-center gap-6 mt-4">
            <button
                onClick={() => onToggle?.('current')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300",
                    showCurrent
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        : "bg-slate-900/50 border-slate-800 text-slate-500"
                )}
            >
                <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    showCurrent ? "bg-blue-500" : "bg-slate-600"
                )} />
                <span className="text-xs font-bold uppercase tracking-wider">{currentLabel}</span>
            </button>

            <button
                onClick={() => onToggle?.('previous')}
                className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300",
                    showPrevious
                        ? "bg-slate-500/10 border-slate-500/30 text-slate-400"
                        : "bg-slate-900/50 border-slate-800 text-slate-500"
                )}
            >
                <div className={cn(
                    "w-2.5 h-2.5 rounded-full border border-dashed border-slate-400",
                    showPrevious ? "bg-slate-500/50" : "bg-transparent"
                )} />
                <span className="text-xs font-bold uppercase tracking-wider">{previousLabel}</span>
            </button>
        </div>
    );
}
