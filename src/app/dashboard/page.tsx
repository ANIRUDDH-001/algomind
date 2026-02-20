'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProgress } from '@/hooks/useProgress';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ExportReportButton } from '@/components/dashboard/ExportReportButton';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { RadarChart } from '@/components/charts/RadarChart';
import { RadarChartLegend } from '@/components/charts/RadarChartLegend';
import { EmptyState } from '@/components/assessment/EmptyState';
import { SessionTimeline } from '@/components/dashboard/SessionTimeline';
import { LeetCodePrompt } from '@/components/onboarding/LeetCodePrompt';
import { SkillTrendCard } from '@/components/dashboard/SkillTrendCard';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { RecommendationEngine, Recommendation } from '@/lib/recommendations/engine';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { Brain, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { SessionHistory } from '@/types/assessment';
import { useSwipeable } from 'react-swipeable';

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { progress, isLoading, error } = useProgress();

    // Initialize tab from URL or default to overview
    const initialTab = (searchParams.get('tab') as string) || 'overview';
    const validTabs = ['overview', 'skills', 'history', 'insights'] as const;
    const defaultTab: typeof validTabs[number] = validTabs.includes(initialTab as any) ? (initialTab as any) : 'overview';
    const [activeTab, setActiveTab] = useState<typeof validTabs[number]>(defaultTab);
    const [showPrevious, setShowPrevious] = useState(false);

    // Handler for clicking on a session in history or timeline
    const handleSessionClick = useCallback((session: SessionHistory) => {
        // Navigate to interview page with the problem and session ID for read-only view
        router.push(`/interview?problemId=${session.problemId}&sessionId=${session.sessionId}`);
    }, [router]);

    // State for asynchronous recommendations
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    useEffect(() => {
        async function fetchRecommendations() {
            if (!progress) return;
            try {
                const results = await new RecommendationEngine().analyze(progress);
                setRecommendations(results);
            } catch (err) {
                console.error('Failed to fetch recommendations:', err);
            }
        }
        fetchRecommendations();
    }, [progress]);
    // Sync tab state with URL parameters
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && ['overview', 'skills', 'history', 'insights'].includes(tabParam)) {
            setActiveTab(tabParam as 'overview' | 'skills' | 'history' | 'insights');
        }
    }, [searchParams]);

    // Update URL when tab changes
    const handleTabChange = (tab: string) => {
        setActiveTab(tab as 'overview' | 'skills' | 'history' | 'insights');
        const url = new URL(window.location.href);
        url.searchParams.set('tab', tab);
        window.history.pushState({}, '', url.toString());
    };

    // Swipe handlers
    const tabs = ['overview', 'skills', 'history', 'insights'] as const;
    const handlers = useSwipeable({
        onSwipedLeft: () => {
            const currentIndex = tabs.indexOf(activeTab);
            if (currentIndex < tabs.length - 1) {
                handleTabChange(tabs[currentIndex + 1]);
            }
        },
        onSwipedRight: () => {
            const currentIndex = tabs.indexOf(activeTab);
            if (currentIndex > 0) {
                handleTabChange(tabs[currentIndex - 1]);
            }
        },
        trackMouse: false
    });

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
                <div className="max-w-md space-y-4">
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <h2 className="text-red-400 font-bold text-xl">Oops! Failed to load progress</h2>
                        <p className="text-slate-500 text-sm mt-2">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const latestSession = progress?.sessions[0];
    const previousSession = progress?.sessions[1];


    return (
        <div {...handlers} className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <LeetCodePrompt />
            <div className="max-w-7xl mx-auto">
                <DashboardHeader progress={progress} />

                <DashboardNav activeTab={activeTab} onTabChange={handleTabChange} />

                {!isLoading && (!progress || progress.totalSessions === 0) ? (
                    <EmptyState
                        title="Your journey hasn't started yet!"
                        description="Complete your first voice-enabled interview to see your cognitive skill profile here."
                    />
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        {activeTab === 'overview' && (
                            <>
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                    {/* Radar Chart - Left Half */}
                                    <div className="lg:col-span-12 xl:col-span-7 h-full">
                                        <DashboardCard
                                            title="Cognitive Skill Profile"
                                            subtitle="Assessment based on your latest interactions"
                                            isLoading={isLoading}
                                            data-tour="cognitive-profile"
                                        >
                                            <div className="flex flex-col items-center justify-center h-full py-4">
                                                {latestSession ? (
                                                    <>
                                                        <RadarChart
                                                            currentScores={latestSession.skills}
                                                            previousScores={previousSession?.skills}
                                                            showComparison={showPrevious}
                                                            size="medium"
                                                        />
                                                        <RadarChartLegend
                                                            showPrevious={showPrevious}
                                                            onToggle={(type) => type === 'previous' && setShowPrevious(!showPrevious)}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-20 opacity-30 text-slate-500">
                                                        <Brain className="w-16 h-16 mb-4" />
                                                        <p>No assessment data available</p>
                                                    </div>
                                                )}
                                            </div>
                                        </DashboardCard>
                                    </div>

                                    {/* Stats & Overview - Right Half */}
                                    <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                                        <DashboardCard
                                            title="Performance Insights"
                                            subtitle="Practice stats and skill distribution"
                                            isLoading={isLoading}
                                        >
                                            <StatsOverview progress={progress} />
                                        </DashboardCard>
                                    </div>
                                </div>

                                <SessionTimeline sessions={progress?.sessions || []} onSessionClick={handleSessionClick} />
                            </>
                        )}

                        {activeTab === 'skills' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="skills-grid">
                                {Object.keys(SKILL_DEFINITIONS).map((skillId) => (
                                    <SkillTrendCard
                                        key={skillId}
                                        skill={skillId as keyof typeof SKILL_DEFINITIONS}
                                        sessions={progress?.sessions || []}
                                    />
                                ))}
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="lg:col-span-12">
                                <DashboardCard
                                    title="Complete History"
                                    subtitle="Detailed list of all your practice sessions"
                                    isLoading={isLoading}
                                >
                                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-800" data-tour="history-list">
                                        {progress?.sessions.map((session) => (
                                            <div
                                                key={session.sessionId}
                                                onClick={() => handleSessionClick(session)}
                                                className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-900/40 border border-slate-800 rounded-2xl gap-4 hover:border-blue-500/30 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-xl flex items-center justify-center font-black text-white",
                                                        session.overallScore >= 7.5 ? "bg-emerald-500" :
                                                            session.overallScore >= 5.5 ? "bg-blue-500" : "bg-amber-500"
                                                    )}>
                                                        {session.overallScore.toFixed(1)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white uppercase tracking-wide text-sm">{session.problemId.replace(/-/g, ' ')}</h4>
                                                        <p className="text-xs text-slate-500">{format(new Date(session.timestamp), 'PPP p')}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-4">
                                                    <div className="hidden sm:block">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Duration</p>
                                                        <p className="text-sm font-bold text-slate-300">{Math.floor((session.duration || 0) / 60)}m {Math.floor((session.duration || 0) % 60)}s</p>
                                                    </div>
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <ExportReportButton progress={{
                                                            ...progress!,
                                                            sessions: [session],
                                                            totalSessions: 1,
                                                            averageScore: session.overallScore
                                                        }} />
                                                    </div>
                                                    <button
                                                        onClick={() => handleSessionClick(session)}
                                                        className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-blue-400"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </DashboardCard>
                            </div>
                        )}

                        {activeTab === 'insights' && (
                            <div className="space-y-8">
                                <div className="flex flex-col gap-1">
                                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Personalized Insights</h2>
                                    <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">AI-generated path based on your cognitive profile</p>
                                </div>

                                {progress && (
                                    <RecommendationsPanel
                                        recommendations={recommendations}
                                    />
                                )}

                                <div className="p-8 border border-slate-800 bg-slate-900/40 rounded-3xl flex flex-col md:flex-row items-center gap-6 group">
                                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                                        <Brain className="w-8 h-8 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold mb-1 uppercase tracking-wide">Next Milestone</h4>
                                        <p className="text-sm text-slate-500 max-w-xl">
                                            Complete 3 more sessions focused on **Complexity Analysis** to reach your next skill milestone and unlock detailed performance benchmarks.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 rounded-full animate-spin border-t-transparent shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
            </div>
        }>
            <DashboardContent />
        </React.Suspense>
    );
}
