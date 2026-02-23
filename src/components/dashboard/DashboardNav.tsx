'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { LayoutGrid, BarChart3, History, Lightbulb, Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type TabId = 'overview' | 'skills' | 'history' | 'insights' | 'campaigns';

interface DashboardNavProps {
    activeTab: TabId;
    onTabChange?: (tab: TabId) => void;
    isLinkMode?: boolean;
}

export function DashboardNav({ activeTab, onTabChange, isLinkMode }: DashboardNavProps) {
    const router = useRouter();
    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'skills', label: 'Skills', icon: BarChart3 },
        { id: 'history', label: 'History', icon: History },
        { id: 'insights', label: 'Insights', icon: Lightbulb },
        { id: 'campaigns', label: 'Assessments', icon: Flag },
    ] as const;

    const handleTabClick = (tabId: TabId) => {
        if (isLinkMode) {
            if (tabId === 'campaigns') {
                router.push('/dashboard/interview-history');
            } else {
                router.push(`/dashboard?tab=${tabId}`);
            }
        } else {
            if (tabId === 'campaigns') {
                router.push('/dashboard/interview-history');
            } else {
                onTabChange?.(tabId);
            }
        }
    };

    return (
        <div className="w-full overflow-x-auto mobile-scroll-container mb-8 -mx-2 px-2">
            <nav className="flex items-center gap-1 p-1.5 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl w-max min-w-full sm:w-fit shadow-2xl">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id as TabId)}
                            data-tour={`tab-${tab.id}`}
                            className={cn(
                                "flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 group whitespace-nowrap",
                                isActive
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                            )}
                        >
                            <Icon className={cn(
                                "w-4 h-4 transition-transform group-hover:scale-110 flex-shrink-0",
                                isActive ? "text-white" : "text-slate-500"
                            )} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
