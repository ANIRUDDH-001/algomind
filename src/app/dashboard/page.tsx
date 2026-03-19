'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useProgress } from '@/hooks/useProgress';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ExportReportButton } from '@/components/dashboard/ExportReportButton';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { ConceptHeatmap } from '@/components/knowledge/ConceptHeatmap';
import { EmptyState } from '@/components/assessment/EmptyState';
import { SessionTimeline } from '@/components/dashboard/SessionTimeline';
import { ReviewQueueWidget } from '@/components/dashboard/ReviewQueueWidget';
import { SkillTrendCard } from '@/components/dashboard/SkillTrendCard';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { RecommendationEngine, Recommendation } from '@/lib/recommendations/engine';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';
import { ShareReplayButton } from '@/components/dashboard/ShareReplayButton';
import { ComingSoonSection } from '@/components/dashboard/ComingSoonSection';
import { useReviewCount } from '@/hooks/useReviewCount';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { SessionHistory } from '@/types/assessment';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { progress, isLoading, error } = useProgress();

    // Initialize tab from URL or default to overview
    const initialTab = (searchParams.get('tab') as string) || 'overview';
    const validTabs = ['overview', 'skills', 'history', 'insights'] as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultTab: typeof validTabs[number] = validTabs.includes(initialTab as any) ? (initialTab as any) : 'overview';
    const [activeTab, setActiveTab] = useState<typeof validTabs[number]>(defaultTab);
    const [direction, setDirection] = useState(1);
    const { count: reviewDueCount } = useReviewCount();

    // Handler for clicking on a session in history or timeline
    const handleSessionClick = useCallback((session: SessionHistory) => {
        if (!session?.sessionId) return; // Guard: don't navigate with a null session
        router.push(`/interview/analysis?sessionId=${session.sessionId}`);
    }, [router]);

    // State for asynchronous recommendations (memoized to avoid render cycle issues)
    const recommendations = React.useMemo(() => {
        if (!progress) return [];
        return new RecommendationEngine().analyze(progress);
    }, [progress]);

    // Sync tab state with URL parameters
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam && ['overview', 'skills', 'history', 'insights'].includes(tabParam)) {
            setActiveTab((current) => {
                if (current !== tabParam) {
                    const tempValidTabs = ['overview', 'skills', 'history', 'insights'];
                    setDirection(tempValidTabs.indexOf(tabParam) >= tempValidTabs.indexOf(current) ? 1 : -1);
                    return tabParam as 'overview' | 'skills' | 'history' | 'insights';
                }
                return current;
            });
        }
    }, [searchParams]);

    // Update URL when tab changes
    const handleTabChange = (tab: string) => {
        setActiveTab((current) => {
            if (current !== tab) {
                const tempValidTabs = ['overview', 'skills', 'history', 'insights'];
                setDirection(tempValidTabs.indexOf(tab) >= tempValidTabs.indexOf(current) ? 1 : -1);
            }
            return tab as 'overview' | 'skills' | 'history' | 'insights';
        });
        router.push(`?tab=${tab}`, { scroll: false });
    };

    // Swipe handlers
    const tabs = ['overview', 'skills', 'history', 'insights'] as const;
    const { handlers, currentIndex } = useSwipeNavigation({
        tabs,
        activeTab,
        onTabChange: handleTabChange
    });

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 text-center">
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
        <div {...handlers} className="min-h-screen text-zinc-100 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div className="max-w-7xl mx-auto">
                <DashboardHeader
                    progress={progress}
                />

                <DashboardNav activeTab={activeTab} onTabChange={handleTabChange} reviewDueCount={reviewDueCount} />

                {/* Swipe indicator — mobile only */}
                <div className="flex sm:hidden swipe-dots mb-6">
                    {tabs.map((tab, i) => (
                        <div key={tab} className={`swipe-dot ${i === currentIndex ? 'active' : ''}`} />
                    ))}
                </div>

                {!isLoading && (!progress || progress.totalSessions === 0) ? (
                    <EmptyState
                        title="Your journey hasn't started yet!"
                        description="Complete your first voice-enabled interview to see your cognitive skill profile here."
                        actionLabel={
                            typeof window !== 'undefined' &&
                                localStorage.getItem('algomind_tour_completed') === 'true'
                                ? 'Start My First Session'
                                : undefined
                        }
                        onAction={
                            typeof window !== 'undefined' &&
                                localStorage.getItem('algomind_tour_completed') === 'true'
                                ? () => router.push('/interview')
                                : undefined
                        }
                    />
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: direction * 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction * -20 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="space-y-8"
                        >
                            {activeTab === 'overview' && (
                                <>
                                    {/* Review Queue — above stats when reviews are due */}
                                    {progress?.userId && reviewDueCount > 0 && (
                                        <ReviewQueueWidget userId={progress.userId} />
                                    )}

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                        {/* Concept Heatmap - Left Half */}
                                        <div className="lg:col-span-12 xl:col-span-7 h-full">
                                            <DashboardCard
                                                title="Concept Knowledge Map"
                                                subtitle="20 core DSA concepts with confidence heat levels"
                                                isLoading={isLoading}
                                                data-tour="cognitive-profile"
                                            >
                                                <div className="h-full py-2">
                                                    <ConceptHeatmap className="w-full" />
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

                                    {progress?.userId && reviewDueCount === 0 && (
                                        <ReviewQueueWidget userId={progress.userId} />
                                    )}

                                    {/* Kai's Cognitive Narrative */}
                                    {progress?.narrative && (
                                        <div className="rounded-2xl border border-white/5 p-5 bg-slate-900/40">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-black shrink-0">
                                                    K
                                                </div>
                                                <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
                                                    Kai's Assessment
                                                </span>
                                                {progress.narrativeGeneratedAt && (
                                                    <span className="text-[10px] text-zinc-600 ml-auto">
                                                        Updated {new Date(progress.narrativeGeneratedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                                                {progress.narrative}
                                            </p>
                                        </div>
                                    )}

                                    <SessionTimeline sessions={progress?.sessions || []} onSessionClick={handleSessionClick} />
                                </>
                            )}

                            {activeTab === 'skills' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-tour="skills-grid">
                                    {Object.keys(SKILL_DEFINITIONS).map((skillId, i) => (
                                        <motion.div
                                            key={skillId}
                                            initial={{ opacity: 0, y: 16 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            <SkillTrendCard
                                                skill={skillId as keyof typeof SKILL_DEFINITIONS}
                                                sessions={progress?.sessions || []}
                                            />
                                        </motion.div>
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
                                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar" data-tour="history-list">
                                            {progress?.sessions.map((session) => (
                                                <div
                                                    key={session.sessionId}
                                                    onClick={() => !isLoading && handleSessionClick(session)}
                                                    className={cn(
                                                        "flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl gap-4 transition-colors",
                                                        isLoading ? "opacity-50 cursor-wait pointer-events-none" : "cursor-pointer hover:brightness-110"
                                                    )}
                                                    style={{
                                                        background: 'var(--surface-1)',
                                                        border: '1px solid var(--surface-edge)',
                                                        borderLeft: `3px solid ${session.overallScore >= 7.5 ? '#10b981' : session.overallScore >= 5.5 ? '#6366f1' : '#f59e0b'}`
                                                    }}
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
                                                            <p className="text-xs text-zinc-500">{format(new Date(session.timestamp), 'PPP p')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex items-center gap-4">
                                                        <div className="hidden sm:block">
                                                            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Duration</p>
                                                            <p className="text-sm font-bold text-zinc-300">{Math.floor((session.duration || 0) / 60)}m {Math.floor((session.duration || 0) % 60)}s</p>
                                                        </div>
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <ExportReportButton progress={{
                                                                ...progress!,
                                                                sessions: [session],
                                                                totalSessions: 1,
                                                                averageScore: session.overallScore
                                                            }} />
                                                        </div>
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <ShareReplayButton sessionId={session.sessionId} />
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

                                    {progress?.userId && (
                                        <InsightsPanel userId={progress.userId} />
                                    )}

                                    <div className="p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 group" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                                            <Brain className="w-8 h-8 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold mb-1 uppercase tracking-wide">Next Milestone</h4>
                                            <p className="text-sm text-zinc-500 max-w-xl">
                                                Complete 3 more sessions focused on <strong>Complexity Analysis</strong> to reach your next skill milestone and unlock detailed performance benchmarks.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}

                {/* Coming Soon Section — always visible regardless of session count */}
                <div className="mt-8">
                    <ComingSoonSection />
                </div>
            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
            </div>
        }>
            <DashboardContent />
        </React.Suspense>
    );
}
