/**
 * @codesage
 */
// @ts-nocheck

'use client';

//  -- automated unused local suppression
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDueReviews, getUpcomingReviews } from '@/lib/spaced-repetition/queue';
import { SpacedRepetitionRecord } from '@/lib/spaced-repetition/types';
import { getDueSkills, DueSkill } from '@/lib/spaced-repetition/skill-scheduler';
import { CheckCircle2, ChevronRight, Clock, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { Badge } from '@/components/ui/badge';
import { getSupabase } from '@/lib/supabase/client';

interface ReviewQueueWidgetProps {
    userId: string;
    onDueCountChange?: (count: number) => void;
}

export function ReviewQueueWidget({ userId, onDueCountChange }: ReviewQueueWidgetProps) {
    const router = useRouter();
    const [dueReviews, setDueReviews] = useState<SpacedRepetitionRecord[]>([]);
    const [upcomingReviews, setUpcomingReviews] = useState<SpacedRepetitionRecord[]>([]);
    const [reviewedThisWeek, setReviewedThisWeek] = useState(0);
    const [dueSkillsList, setDueSkillsList] = useState<DueSkill[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function fetchQueue() {
            try {
                setIsLoading(true);
                const supabase = getSupabase();
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const [due, upcoming, { count }, skills] = await Promise.all([
                    getDueReviews(userId),
                    getUpcomingReviews(userId, 7),
                    supabase
                        ? supabase
                            .from('spaced_repetition')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', userId)
                            .gte('last_reviewed_at', sevenDaysAgo)
                        : { count: 0 },
                    getDueSkills(userId),
                ]);

                if (mounted) {
                    setDueReviews(due || []);
                    setUpcomingReviews(upcoming || []);
                    setReviewedThisWeek(count || 0);
                    setDueSkillsList(skills || []);
                    onDueCountChange?.((due || []).length);
                }
            } catch (err) {
                console.error('Failed to fetch review queue:', err);
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchQueue();
        return () => { mounted = false; };
    }, [userId, onDueCountChange]);

    if (!isLoading && dueReviews.length === 0 && upcomingReviews.length === 0 && reviewedThisWeek === 0) {
        return null;
    }

    const totalThisWeek = dueReviews.length + upcomingReviews.length + reviewedThisWeek;
    const progressPercent = totalThisWeek > 0
        ? Math.round((reviewedThisWeek / totalThisWeek) * 100)
        : 0;

    const renderDueList = () => {
        const displayLimit = 5;
        const visibleReviews = dueReviews.slice(0, displayLimit);
        const hasMore = dueReviews.length > displayLimit;

        return (
            <div className="space-y-3">
                {visibleReviews.map((review) => {
                    const diffTime = Date.now() - new Date(review.fsrsDueDate).getTime();
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays > 0;

                    // Approximate score from review quality (0-5)
                    const approxScore = review.lastQuality != null ? review.lastQuality * 2 : null;

                    return (
                        <div
                            key={review.problemId}
                            className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-1)]/50 border border-white/8 hover:border-amber-500/30 transition-colors group"
                        >
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                        review.problemDifficulty === 'easy' ? "bg-emerald-500/10 text-emerald-400" :
                                            review.problemDifficulty === 'hard' ? "bg-red-500/10 text-red-400" :
                                                "bg-blue-500/10 text-blue-400"
                                    )}>
                                        {review.problemDifficulty}
                                    </span>
                                    <span className="text-sm font-bold text-zinc-200 capitalize group-hover:text-amber-400 transition-colors">
                                        {review.problemTitle || review.problemId.replace(/-/g, ' ')}
                                    </span>
                                    {approxScore != null && (
                                        <Badge variant="outline" className="text-[9px] bg-[var(--surface-2)]/50 text-zinc-300 border-white/10 h-4 px-1.5 ml-1">
                                            Score: {approxScore}/10
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-400 font-medium">Rep #{review.fsrsReps}</span>
                                    <span className="text-[10px] text-zinc-600">•</span>
                                    <span className={cn(
                                        "text-[10px] font-bold",
                                        isOverdue ? "text-red-400" : "text-amber-400"
                                    )}>
                                        {isOverdue ? `${diffDays} day${diffDays !== 1 ? 's' : ''} overdue` : "Due today"}
                                    </span>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                    "rounded-xl h-8 px-3 text-xs font-bold transition-all",
                                    isOverdue
                                        ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                                        : "bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white"
                                )}
                                onClick={() => router.push(`/interview?problemId=${review.problemId}&mode=review`)}
                            >
                                Start <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    );
                })}

                {hasMore && (
                    <div className="flex items-center justify-between pt-2 px-1">
                        <span className="text-xs font-medium text-zinc-500">And {dueReviews.length - displayLimit} more waiting</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <DashboardCard
            title="Today's Review Queue"
            subtitle="Spaced repetition for better retention"
            isLoading={isLoading}
            className="bg-amber-950/20 border-amber-800/40 rounded-3xl"
        >
            <div className="flex flex-col h-full justify-between">
                <div className="mb-4">
                    {dueReviews.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            </div>
                            <h4 className="text-sm font-bold text-emerald-400">All caught up! 🎉</h4>
                            {upcomingReviews.length > 0 && (
                                <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5">
                                    <Clock className="w-3 h-3" /> Next review: {new Date(upcomingReviews[0].fsrsDueDate).toLocaleDateString()}
                                </p>
                            )}
                        </div>
                    ) : (
                        renderDueList()
                    )}
                </div>

                {/* Skills Due Section */}
                {dueSkillsList.length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">Skills Due for Review</h4>
                        <div className="flex flex-wrap gap-2">
                            {dueSkillsList.map((skill) => (
                                <button
                                    key={skill.skillId}
                                    onClick={() => router.push(`/interview?tags=${skill.suggestedTags.slice(0, 2).join(',')}&mode=review`)}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                                        "border hover:scale-105",
                                        skill.daysOverdue > 3
                                            ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                            : skill.daysOverdue > 0
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                                                : "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
                                    )}
                                >
                                    {skill.skillName}
                                    <span className="text-[10px] opacity-70">
                                        {skill.daysOverdue > 0 ? `${skill.daysOverdue}d overdue` : 'due today'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-auto space-y-2 pt-4 border-t border-amber-800/20">
                    <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                            <Flame className={cn("w-3.5 h-3.5", reviewedThisWeek > 0 ? "text-amber-500" : "text-zinc-600")} />
                            <span className="text-zinc-400 font-medium">
                                {reviewedThisWeek} problem{reviewedThisWeek !== 1 ? 's' : ''} reviewed this week
                            </span>
                        </div>
                        <span className="font-bold text-amber-500">{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[var(--surface-1)]/50 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}
