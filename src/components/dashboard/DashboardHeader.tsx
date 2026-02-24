'use client';

import React from 'react';
import { UserProgress } from '@/types/assessment';
import { Button } from '@/components/ui/button';
import { ExportReportButton } from './ExportReportButton';
import { Brain, PlusCircle, Calendar, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface DashboardHeaderProps {
    progress: UserProgress | null;
    leetcodeUsername?: string | null;
}

export function DashboardHeader({ progress, leetcodeUsername }: DashboardHeaderProps) {
    const latestSession = progress?.sessions?.[0];
    const avgScore = progress?.averageScore || 0;
    const lastDate = latestSession ? format(new Date(latestSession.timestamp), 'MMM d, h:mm a') : '—';
    const totalSessions = progress?.totalSessions || 0;

    return (
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex-1 w-full min-w-0">
                {/* Greeting */}
                <div className="mb-6">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
                        Welcome back
                    </p>
                    <h1 className="text-2xl font-bold text-white truncate text-wrap">
                        {/* Optionally replace Code Explorer with real user name later if added to auth */}
                        {'Code Explorer'}
                        <span className="text-zinc-600 font-normal"> — keep pushing.</span>
                    </h1>
                </div>

                {/* Stats row — horizontal scroll on mobile */}
                <div className="flex gap-3 overflow-x-auto pb-1 mobile-scroll-container -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                    {[
                        { label: 'Sessions', value: totalSessions, sub: null },
                        { label: 'Avg Score', value: `${avgScore.toFixed(1)}`, sub: '/10', accent: true },
                        { label: 'Last Practice', value: lastDate, sub: null },
                        { label: 'LeetCode', value: leetcodeUsername || '—', sub: null, action: !leetcodeUsername ? '/settings' : null },
                    ].map((stat) => {
                        const content = (
                            <>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{stat.label}</span>
                                <span className={stat.accent ? 'text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400' : 'text-lg font-bold text-zinc-200'}>
                                    {stat.value}{stat.sub && <span className="text-xs text-zinc-600 ml-0.5">{stat.sub}</span>}
                                </span>
                            </>
                        );

                        const className = "flex-shrink-0 px-4 py-3 rounded-xl flex flex-col gap-0.5 min-w-[100px]";
                        const style = { background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' };

                        if (stat.action) {
                            return (
                                <Link href={stat.action} key={stat.label} className={`${className} hover:brightness-110 transition-all`} style={style}>
                                    {content}
                                </Link>
                            );
                        }

                        return (
                            <div key={stat.label} className={className} style={style}>
                                {content}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0 md:pb-1">
                <ExportReportButton progress={progress} />
                <Link href="/practice">
                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 px-6 sm:px-8 shadow-xl shadow-indigo-900/20 transition-all active:scale-95 w-full sm:w-auto">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Start Practice
                    </Button>
                </Link>
            </div>
        </header>
    );
}
