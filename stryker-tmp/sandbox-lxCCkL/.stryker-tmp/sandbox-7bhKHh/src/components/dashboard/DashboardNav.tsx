// @ts-nocheck
// 
// @codesage
'use client';

//  -- automated unused local suppression
import React from 'react';
import { cn } from '@/lib/utils';
import { LayoutGrid, Brain, BarChart3, History, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';

export type TabId = 'overview' | 'knowledge' | 'skills' | 'history' | 'insights';

interface DashboardNavProps {
    activeTab: TabId;
    onTabChange?: (tab: TabId) => void;
    isLinkMode?: boolean;
    reviewDueCount?: number;
}

export function DashboardNav({ activeTab, onTabChange, isLinkMode, reviewDueCount = 0 }: DashboardNavProps) {
    const router = useRouter();
    const tabs = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid },
        { id: 'knowledge', label: 'Knowledge', icon: Brain },
        { id: 'skills', label: 'Skills', icon: BarChart3 },
        { id: 'history', label: 'History', icon: History },
        { id: 'insights', label: 'Insights', icon: Lightbulb },
    ] as const;

    const handleTabClick = (tabId: TabId) => {
        if (isLinkMode) {
            router.push(`/dashboard?tab=${tabId}`);
        } else {
            onTabChange?.(tabId);
        }
    };

    return (
        <div className="relative w-full mb-8">
            {/* Scroll affordance — right fade */}
            <div
                className="absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10 md:hidden"
                style={{
                    background: 'linear-gradient(to right, transparent, var(--surface-base))'
                }}
                aria-hidden="true"
            />

            <div className="w-full overflow-x-auto mobile-scroll-container snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0" role="region" aria-label="Dashboard navigation tabs">
                <nav className="flex items-center gap-1 p-1.5 backdrop-blur-xl rounded-2xl w-max min-w-full sm:w-fit shadow-2xl" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab.id as TabId)}
                            data-tour={`tab-${tab.id}`}
                            className={cn(
                                "flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 group whitespace-nowrap snap-start",
                                isActive
                                    ? "text-white shadow-lg shadow-indigo-500/20"
                                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                            )}
                            style={isActive ? { background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' } : {}}
                        >
                            <Icon className={cn(
                                "w-4 h-4 transition-transform group-hover:scale-110 shrink-0",
                                isActive ? "text-white" : "text-zinc-500"
                            )} />
                            <span>{tab.label}</span>

                            {/* Review Due Badge */}
                            {tab.id === 'overview' && reviewDueCount > 0 && (
                                <span className={cn(
                                    "ml-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black",
                                    isActive ? "bg-white text-indigo-600" : "bg-red-500 text-white animate-pulse"
                                )}>
                                    {reviewDueCount > 9 ? '9+' : reviewDueCount}
                                </span>
                            )}
                        </button>
                    );
                })}
                </nav>
            </div>
        </div>
    );
}
