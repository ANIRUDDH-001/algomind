import React from 'react';
import { BookOpen, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InterviewTopBarProps {
    problemTitle: string;
    difficultyMode: string;
    isCollapsed: boolean;
    onToggleProblem: () => void;
    onEnd: () => void;
    hasStarted: boolean;
    readOnly: boolean;
    roundCount: number;
    timerNode?: React.ReactNode;
}

export function InterviewTopBar({
    problemTitle,
    difficultyMode,
    isCollapsed,
    onToggleProblem,
    onEnd,
    hasStarted,
    readOnly,
    roundCount,
    timerNode,
}: InterviewTopBarProps) {
    return (
        <div className="h-11 shrink-0 flex items-center gap-3 px-3 border-b"
             style={{ background: 'var(--surface-1)', borderColor: 'var(--surface-edge)' }}>
          
            {/* Problem toggle */}
            {!isCollapsed && (
                <button onClick={onToggleProblem} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white rounded">
                    <BookOpen className="w-4 h-4" />
                </button>
            )}
            
            {/* Problem title (truncated) */}
            <span className="text-xs text-zinc-500 truncate max-w-[200px] hidden md:block" title={problemTitle}>
                {problemTitle}
            </span>
            
            {/* Mode badge */}
            <Badge className="hidden sm:flex capitalize text-[10px]">{difficultyMode}</Badge>
            
            <div className="flex-1" />
            
            {/* Timer / Info chip */}
            {timerNode}
            
            {/* End button */}
            {hasStarted && !readOnly && (
                <Button variant="ghost" size="sm" onClick={onEnd}
                        disabled={roundCount < 1}
                        title={roundCount < 1 ? 'Complete at least 1 round before ending' : 'End interview and see analysis'}
                        className="text-red-400 hover:text-white hover:bg-red-500/20 text-[11px] font-bold uppercase tracking-widest h-8 px-2.5 rounded-lg">
                    <Flag className="w-3.5 h-3.5 mr-1.5" /> End & Analyze
                </Button>
            )}
        </div>
    );
}
