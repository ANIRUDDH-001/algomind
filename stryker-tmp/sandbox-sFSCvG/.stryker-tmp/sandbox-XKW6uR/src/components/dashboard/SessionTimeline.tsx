/**
 * @codesage
 */
// @ts-nocheck

// 

'use client';


//  -- automated unused local suppression
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(false);

    const updateScrollEdges = useCallback(() => {
        const container = scrollRef.current;
        if (!container) return;

        const maxScrollLeft = container.scrollWidth - container.clientWidth;
        const left = container.scrollLeft;
        const threshold = 4;

        setAtStart(left <= threshold);
        setAtEnd(left >= maxScrollLeft - threshold);
    }, []);

    const scrollByCardStep = useCallback((direction: 'left' | 'right') => {
        const container = scrollRef.current;
        if (!container) return;

        const firstItem = container.querySelector('[data-session-item]') as HTMLElement | null;
        const step = Math.max(firstItem?.getBoundingClientRect().width ?? 160, 120);
        const delta = direction === 'left' ? -step : step;

        container.scrollBy({ left: delta, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            scrollRef.current.scrollTo({
                left: scrollRef.current.scrollWidth,
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
            });

            requestAnimationFrame(updateScrollEdges);
        }
    }, [sessions, updateScrollEdges]);

    useEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        container.addEventListener('scroll', updateScrollEdges, { passive: true });
        window.addEventListener('resize', updateScrollEdges);
        updateScrollEdges();

        return () => {
            container.removeEventListener('scroll', updateScrollEdges);
            window.removeEventListener('resize', updateScrollEdges);
        };
    }, [updateScrollEdges]);

    if (!sessions || sessions.length === 0) return null;

    // Milestone logic: every 5th session
    const isMilestone = (index: number) => (sessions.length - index) % 5 === 0 && (sessions.length - index) !== 0;

    return (
        <div className="relative group/timeline w-full bg-(--surface-1)/10 rounded-3xl p-6 border border-white/8/30 overflow-hidden shadow-inner" data-tour="journey-progress">
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                        <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-wide uppercase">Journey Progress</h3>
                        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mt-0.5">
                            {sessions.length} sessions completed
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-(--surface-2)"
                        onClick={() => scrollByCardStep('left')}
                        aria-label="Scroll timeline left"
                        aria-controls="session-timeline-container"
                        disabled={atStart}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-(--surface-2)"
                        onClick={() => scrollByCardStep('right')}
                        aria-label="Scroll timeline right"
                        aria-controls="session-timeline-container"
                        disabled={atEnd}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div
                className={`pointer-events-none absolute left-0 top-18 bottom-0 w-10 transition-opacity duration-200 md:hidden ${atStart ? 'opacity-0' : 'opacity-100'}`}
                style={{ background: 'linear-gradient(to left, transparent, var(--surface-1))' }}
                aria-hidden="true"
            />
            <div
                className={`pointer-events-none absolute right-0 top-18 bottom-0 w-10 transition-opacity duration-200 md:hidden ${atEnd ? 'opacity-0' : 'opacity-100'}`}
                style={{ background: 'linear-gradient(to right, transparent, var(--surface-1))' }}
                aria-hidden="true"
            />

            <div
                id="session-timeline-container"
                ref={scrollRef}
                className="flex items-start gap-0 overflow-x-auto pb-6 pt-2 scrollbar-hide relative no-scrollbar mobile-scroll-container snap-x snap-mandatory"
                style={{ scrollBehavior: 'smooth' }}
                role="region"
                aria-label="Session timeline"
            >
                {/* Draw Line */}
                <div className="absolute top-6.5 left-14 right-14 h-0.5 bg-linear-to-r from-slate-800/10 via-slate-800 to-slate-800/10 z-0" />

                {sessions.slice().reverse().map((session, index) => (
                    <div key={session.sessionId} className="flex flex-col items-center relative snap-start" data-session-item>
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
