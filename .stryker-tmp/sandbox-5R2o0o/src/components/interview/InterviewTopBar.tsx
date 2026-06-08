/**
 * @codesage
 * @file      src/components/interview/InterviewTopBar.tsx
 * @purpose   Top navigation bar for the interview interface, showing context and controls.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import React from 'react';
import { BookOpen, Flag, PanelLeftClose, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InterviewTopBarProps {
    problemTitle: string;
    difficultyMode: string;
    conceptTags?: string[];
    isCollapsed: boolean;
    onToggleProblem: () => void;
    onEnd: () => void;
    hasStarted: boolean;
    readOnly: boolean;
    roundCount: number;
    timerNode?: React.ReactNode;
    onBack?: () => void;
}

export function InterviewTopBar({
    problemTitle,
    difficultyMode,
    conceptTags,
    isCollapsed,
    onToggleProblem,
    onEnd,
    hasStarted,
    readOnly,
    roundCount,
    timerNode,
    onBack,
}: InterviewTopBarProps) {
    const modeLabels: Record<string, string> = {
        'warm-up': 'Warm Up',
        'practice': 'Practice',
        'crunch': 'Crunch',
        'sprint': 'Sprint',
        'employer': 'Assessment',
    };

    const modeColors: Record<string, string> = {
        'warm-up': 'bg-emerald-950/60 text-emerald-400 border-emerald-500/20',
        'practice': 'bg-blue-950/60 text-blue-400 border-blue-500/20',
        'crunch': 'bg-amber-950/60 text-amber-400 border-amber-500/20',
        'sprint': 'bg-red-950/60 text-red-400 border-red-500/20',
        'employer': 'bg-purple-950/60 text-purple-400 border-purple-500/20',
    };

    return (
        <div className="h-11 shrink-0 flex items-center gap-3 px-3 border-b"
             style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
          
            {/* Back button (optional) */}
            {onBack && (
                <button 
                    onClick={onBack} 
                    className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors mr-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Back</span>
                </button>
            )}

            {/* Problem toggle */}
            <button onClick={onToggleProblem} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white rounded" title={isCollapsed ? "Show problem" : "Hide problem"}>
                {isCollapsed ? <BookOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            
            {/* Problem title (truncated) */}
            <span className="text-xs text-zinc-500 truncate max-w-[200px] hidden md:block" title={problemTitle}>
                {problemTitle}
            </span>
            
            {/* Mode badge */}
            <Badge className={`hidden sm:flex text-[10px] border ${modeColors[difficultyMode] ?? 'capitalize'}`}>
                {modeLabels[difficultyMode] ?? difficultyMode}
            </Badge>

            {conceptTags && conceptTags.length > 0 && (
                <div className="hidden md:flex items-center gap-1.5 overflow-hidden">
                    {conceptTags.slice(0, 3).map((tag) => (
                        <span
                            key={tag}
                            className="text-[10px] text-zinc-500 bg-zinc-900/40 px-2 py-0.5 rounded-full border border-zinc-700/20 whitespace-nowrap"
                        >
                            {tag.replace(/-/g, ' ')}
                        </span>
                    ))}
                </div>
            )}
            
            <div className="flex-1" />
            
            {/* Timer / Info chip */}
            {timerNode}
            
            {hasStarted && !readOnly && (
                <Button variant="ghost" size="sm" onClick={onEnd}
                        disabled={roundCount < 1}
                        title={roundCount < 1 ? 'Complete at least 1 exchange (one Kai turn + your response) before ending' : 'End interview and see analysis'}
                        className="text-red-400 hover:text-white hover:bg-red-500/20 text-[11px] font-bold uppercase tracking-widest h-8 px-2.5 rounded-lg">
                    <Flag className="w-3.5 h-3.5 mr-1.5" /> End & Analyze
                </Button>
            )}
        </div>
    );
}
