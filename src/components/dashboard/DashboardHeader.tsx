'use client';

import React from 'react';
import { UserProgress } from '@/types/assessment';
import { Button } from '@/components/ui/button';
import { ExportReportButton } from './ExportReportButton';
import { Brain, PlusCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface DashboardHeaderProps {
    progress: UserProgress | null;
}

export function DashboardHeader({ progress }: DashboardHeaderProps) {
    const latestSession = progress?.sessions[0];
    const avgScore = progress?.averageScore || 0;

    return (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                        <Brain className="w-6 h-6 text-blue-400" />
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Hey there, Code Explorer!
                    </h1>
                </div>

                <div className="flex items-center gap-6 text-sm">
                    <div className="flex flex-col">
                        <span className="text-slate-500 uppercase tracking-widest text-[10px] font-black">Total Sessions</span>
                        <span className="text-white font-bold">{progress?.totalSessions || 0}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="flex flex-col">
                        <span className="text-slate-500 uppercase tracking-widest text-[10px] font-black">Overall Score</span>
                        <span className="text-2xl font-black text-blue-400">{(avgScore).toFixed(1)}<span className="text-xs text-slate-600">/10</span></span>
                    </div>
                    {latestSession && (
                        <>
                            <div className="w-px h-8 bg-slate-800" />
                            <div className="flex flex-col">
                                <span className="text-slate-500 uppercase tracking-widest text-[10px] font-black">Last Practice</span>
                                <span className="text-slate-300 font-medium flex items-center gap-1.5">
                                    <Calendar className="w-3 h-3 text-slate-500" />
                                    {format(new Date(latestSession.timestamp), 'MMM d, h:mm a')}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <ExportReportButton progress={progress} />
                <Link href="/practice">
                    <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 px-6 sm:px-8 shadow-xl shadow-blue-500/20 transition-all active:scale-95 w-full sm:w-auto">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Start Practice
                    </Button>
                </Link>
            </div>
        </header>
    );
}
