'use client';

import React, { useRef, useEffect } from 'react';
import { SessionHistory } from '@/types/assessment';
import { SessionNode } from './SessionNode';
import { ChevronRight, ChevronLeft, Trophy, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionTimelineProps {
    sessions: SessionHistory[];
    onSessionClick?: (session: SessionHistory) => void;
}

export function SessionTimeline({ sessions, onSessionClick }: SessionTimelineProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to latest session on mount
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, [sessions]);

    if (!sessions || sessions.length === 0) return null;

    // Milestone logic: every 5th session
    const isMilestone = (index: number) => (sessions.length - index) % 5 === 0 && (sessions.length - index) !== 0;

    return (
        <div className="relative group/timeline w-full bg-slate-900/10 rounded-3xl p-6 border border-slate-800/30 overflow-hidden shadow-inner">
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Journey Progress</h3>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-0.5">
                            {sessions.length} sessions completed
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800"
                        onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-white hover:bg-slate-800"
                        onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex items-start gap-0 overflow-x-auto pb-6 pt-2 scrollbar-hide relative no-scrollbar"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Draw Line */}
                <div className="absolute top-[26px] left-14 right-14 h-0.5 bg-gradient-to-r from-slate-800/10 via-slate-800 to-slate-800/10 z-0" />

                {sessions.slice().reverse().map((session, index) => (
                    <div key={session.sessionId} className="flex flex-col items-center relative">
                        {isMilestone(index) && (
                            <div className="absolute -top-10 flex flex-col items-center group/milestone">
                                <div className="p-1 px-2 mb-1 bg-amber-500/10 border border-amber-500/40 rounded-full text-[8px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                                    Milestone
                                </div>
                                <Trophy className="w-4 h-4 text-amber-500" />
                            </div>
                        )}

                        <SessionNode
                            session={session}
                            isLatest={index === sessions.length - 1}
                            onClick={() => onSessionClick?.(session)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
