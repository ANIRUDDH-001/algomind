/**
 * @codesage
 * @file      src/app/dashboard/page.tsx
 * @purpose   Main dashboard page displaying user progress, stats, skill profiles, and session history.
 * @tech      Next.js, React, Framer Motion, Tailwind CSS
 * @connects  @/hooks/useProgress, @/components/dashboard/*
 * @apis      /api/user/me, /api/user/placement-context
 * @db        None (handled via APIs/RPCs in hooks)
 * @state     activeTab, direction, recommendations, showPlacementCard
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useProgress } from '@/hooks/useProgress';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { ExportReportButton } from '@/components/dashboard/ExportReportButton';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { EmptyState } from '@/components/assessment/EmptyState';
import { SessionTimeline } from '@/components/dashboard/SessionTimeline';
import { ReviewQueueWidget } from '@/components/dashboard/ReviewQueueWidget';
import { SkillTrendCard } from '@/components/dashboard/SkillTrendCard';
import { RecommendationsPanel } from '@/components/dashboard/RecommendationsPanel';
import { RecommendationEngine } from '@/lib/recommendations/engine';
import { InsightsPanel } from '@/components/dashboard/InsightsPanel';
import { ShareReplayButton } from '@/components/dashboard/ShareReplayButton';
import { useReviewCount } from '@/hooks/useReviewCount';
import { RadarChart } from '@/components/charts/RadarChart';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { AlertTriangle, Brain, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { SessionHistory } from '@/types/assessment';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { RecommendationBanner } from '@/components/dashboard/RecommendationBanner';
import { WeeklyUsageCard } from '@/components/dashboard/WeeklyUsageCard';
import { KnowledgeInsightsCard } from '@/components/dashboard/KnowledgeInsightsCard';
import { PlacementContextCard } from '@/components/onboarding/PlacementContextCard';
import { PlacementOutcomeButton } from '@/components/dashboard/PlacementOutcomeButton';

function DashboardContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { progress, isLoading, error } = useProgress();

    const validTabs = ['overview', 'knowledge', 'skills', 'history', 'insights'] as const;
    type DashboardTab = typeof validTabs[number];
    const isValidTab = (tab: string | null): tab is DashboardTab => {
        return tab !== null && (validTabs as readonly string[]).includes(tab);
    };
    const tabParam = searchParams.get('tab');
    const activeTab: DashboardTab = isValidTab(tabParam) ? tabParam : 'overview';
    const [direction, setDirection] = useState(1);
    const { count: reviewDueCount } = useReviewCount();
    const [recommendations, setRecommendations] = useState<Awaited<ReturnType<RecommendationEngine['analyze']>>>([]);
    const [showPlacementCard, setShowPlacementCard] = useState(false);
    const [tourCompleted] = useState(() =>
        typeof window !== 'undefined' && localStorage.getItem('algomind_tour_completed') === 'true'
    );

    // Handler for clicking on a session in history or timeline
    const handleSessionClick = useCallback((session: SessionHistory) => {
        if (!session?.sessionId) return; // Guard: don't navigate with a null session
        router.push(`/interview/analysis?sessionId=${session.sessionId}`);
    }, [router]);

    useEffect(() => {
        let isMounted = true;

        const loadRecommendations = async () => {
            if (!progress) {
                if (isMounted) {
                    setRecommendations([]);
                }
                return;
            }

            const next = await new RecommendationEngine().analyze(progress);
            if (isMounted) {
                setRecommendations(next);
            }
        };

        void loadRecommendations();

        return () => {
            isMounted = false;
        };
    }, [progress]);

    // Compute weakest skill from last 3 sessions to personalize next focus area.
    const weakestSkill = useMemo(() => {
        if (!progress?.sessions?.length) return null;

        const recentSessions = progress.sessions.slice(-3);
        const skillTotals: Record<string, { sum: number; count: number }> = {};

        recentSessions.forEach((session) => {
            Object.entries(session.skills || {}).forEach(([skill, score]) => {
                if (!skillTotals[skill]) skillTotals[skill] = { sum: 0, count: 0 };
                skillTotals[skill].sum += score as number;
                skillTotals[skill].count += 1;
            });
        });

        const averages = Object.entries(skillTotals).map(([skill, { sum, count }]) => ({
            skill,
            average: sum / count,
        }));

        if (!averages.length) return null;
        averages.sort((a, b) => a.average - b.average);
        return averages[0];
    }, [progress]);

    useEffect(() => {
        if (!progress?.userId) return;

        let cancelled = false;

        fetch('/api/user/me')
            .then((response) => response.json())
            .then((data) => {
                if (!cancelled) {
                    setShowPlacementCard(!data.placementMonth);
                }
            })
            .catch(() => null);

        return () => {
            cancelled = true;
        };
    }, [progress?.userId]);

    const handlePlacementComplete = async (data: { placementMonth: string; targetCompanies: string[] }) => {
        await fetch('/api/user/placement-context', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        setShowPlacementCard(false);
    };

    // Update URL when tab changes
    const handleTabChange = (tab: string) => {
        if (activeTab !== tab) {
            const tempValidTabs = ['overview', 'knowledge', 'skills', 'history', 'insights'];
            setDirection(tempValidTabs.indexOf(tab) >= tempValidTabs.indexOf(activeTab) ? 1 : -1);
        }
        router.push(`?tab=${tab}`, { scroll: false });
    };

    // Swipe handlers
    const tabs = ['overview', 'knowledge', 'skills', 'history', 'insights'] as const;
    const { handlers, currentIndex } = useSwipeNavigation({
        tabs,
        activeTab,
        onTabChange: handleTabChange
    });

    return (
        <div {...handlers} className="flex-1 text-zinc-100 p-4 sm:p-6 lg:p-8 pb-20 md:pb-4 overflow-x-hidden">
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

                {!isLoading && error ? (
                    <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--danger)20' }}>
                        <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-white font-bold mb-2">Failed to load your progress</h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            There was a problem fetching your session data. This is usually temporary.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
                            style={{ background: 'var(--accent-primary)' }}
                        >
                            Try Again
                        </button>
                    </div>
                ) : !isLoading && (!progress || progress.totalSessions === 0) ? (
                    <EmptyState
                        title="Your journey hasn't started yet!"
                        description="Complete your first voice-enabled interview to see your cognitive skill profile here."
                        actionLabel={tourCompleted ? 'Start My First Session' : undefined}
                        onAction={tourCompleted ? () => router.push('/interview') : undefined}
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
                                    {/* Recommendation Banner — top of dashboard */}
                                    {showPlacementCard && (
                                        <PlacementContextCard
                                            onComplete={handlePlacementComplete}
                                            onSkip={() => setShowPlacementCard(false)}
                                        />
                                    )}
                                    <RecommendationBanner />

                                    {/* Review Queue — above stats when reviews are due */}
                                    {progress?.userId && reviewDueCount > 0 && (
                                        <ReviewQueueWidget userId={progress.userId} />
                                    )}

                                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                                        <div className="xl:col-span-7">
                                            <DashboardCard
                                                title="Performance Insights"
                                                subtitle="Practice stats and skill distribution"
                                                isLoading={isLoading}
                                            >
                                                <StatsOverview progress={progress} />
                                            </DashboardCard>
                                        </div>

                                        <div className="xl:col-span-5 space-y-6">
                                            <WeeklyUsageCard />
                                        </div>
                                    </div>

                                    {/* 8D Cognitive Profile Radar */}
                                    {progress && progress.sessions.length > 0 && (
                                        <DashboardCard
                                            title="8-Dimensional Cognitive Profile"
                                            subtitle="Your mastery across 8 core algorithmic skills"
                                            isLoading={isLoading}
                                        >
                                            <RadarChart
                                                currentScores={progress.sessions[progress.sessions.length - 1]?.skills || {}}
                                                previousScores={progress.sessions.length > 1 ? progress.sessions[progress.sessions.length - 2]?.skills : undefined}
                                                showComparison={progress.sessions.length > 1}
                                                size="medium"
                                            />
                                        </DashboardCard>
                                    )}

                                    {progress?.userId && reviewDueCount === 0 && (
                                        <ReviewQueueWidget userId={progress.userId} />
                                    )}

                                    {/* Kai's Cognitive Narrative */}
                                    {progress?.narrative && (
                                        <div className="rounded-2xl border border-white/5 p-5 bg-[var(--surface-1)]/40">
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

                                    {/* Placement Outcome */}
                                    {progress && progress.totalSessions >= 3 && (
                                        <PlacementOutcomeButton />
                                    )}

                                    <SessionTimeline sessions={progress?.sessions || []} onSessionClick={handleSessionClick} />
                                </>
                            )}

                            {activeTab === 'knowledge' && (
                                <div className="space-y-6">
                                    <KnowledgeInsightsCard />

                                    <DashboardCard
                                        title="Targeted Recommendations"
                                        subtitle="Practice prompts based on your current weak spots"
                                        isLoading={isLoading}
                                    >
                                        <RecommendationsPanel recommendations={recommendations} />
                                    </DashboardCard>
                                </div>
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
                                        {/* Scrollable session history list - shows last 600px of content */}
                                        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar" data-tour="history-list">
                                            {progress?.sessions.map((session) => {
                                                const scoreTier =
                                                    session.overallScore >= 7.5 ? 'Excellent' :
                                                        session.overallScore >= 5.5 ? 'Good' :
                                                            'Needs Work';

                                                return (
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
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <div
                                                                aria-label={`Score: ${session.overallScore.toFixed(1)} out of 10 - ${scoreTier}`}
                                                                className={cn(
                                                                    "w-12 h-12 rounded-xl flex items-center justify-center font-black text-white",
                                                                    session.overallScore >= 7.5 ? "bg-emerald-500" :
                                                                        session.overallScore >= 5.5 ? "bg-blue-500" : "bg-amber-500"
                                                                )}
                                                            >
                                                                {session.overallScore.toFixed(1)}
                                                            </div>
                                                            <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500">
                                                                {scoreTier}
                                                            </span>
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
                                                            className="p-2 hover:bg-[var(--surface-2)] rounded-lg transition-colors text-blue-400"
                                                        >
                                                            <ChevronRight className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </DashboardCard>
                                </div>
                            )}

                            {activeTab === 'insights' && (
                                <div className="space-y-8">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Personalized Insights</h2>
                                        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">AI-generated path based on your cognitive profile</p>
                                    </div>

                                    {progress?.userId && (
                                        <InsightsPanel userId={progress.userId} />
                                    )}

                                    <div className="p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 group" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl group-hover:scale-110 transition-transform">
                                            <Brain className="w-8 h-8 text-indigo-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold mb-1 uppercase tracking-wide">Your Next Focus Area</h4>
                                            <p className="text-sm text-zinc-500 max-w-xl">
                                                {weakestSkill ? (
                                                    <>
                                                        Your weakest area is <strong className="text-zinc-300">{SKILL_DEFINITIONS[weakestSkill.skill as keyof typeof SKILL_DEFINITIONS]?.name ?? weakestSkill.skill}</strong> (avg{' '}
                                                        <strong className="text-zinc-300">{weakestSkill.average.toFixed(1)}/10</strong>).
                                                        Focus your next 3 sessions on problems that exercise this dimension to improve your cognitive profile.
                                                    </>
                                                ) : (
                                                    <>
                                                        Complete your first interview session to unlock personalized skill milestone recommendations.
                                                    </>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                )}


            </div>
        </div>
    );
}

export default function DashboardPage() {
    return (
        <React.Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>
            </div>
        }>
            <DashboardContent />
        </React.Suspense>
    );
}
