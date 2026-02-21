'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDueReviews, getUpcomingReviews } from '@/lib/spaced-repetition/queue';
import { SpacedRepetitionRecord } from '@/lib/spaced-repetition/sm2';
import { CheckCircle2, ChevronRight, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DashboardCard } from './DashboardCard';
import { Badge } from '@/components/ui/badge';

interface ReviewQueueWidgetProps {
    userId: string;
}

export function ReviewQueueWidget({ userId }: ReviewQueueWidgetProps) {
    const router = useRouter();
    const [dueReviews, setDueReviews] = useState<SpacedRepetitionRecord[]>([]);
    const [upcomingReviews, setUpcomingReviews] = useState<SpacedRepetitionRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function fetchQueue() {
            try {
                setIsLoading(true);
                const [due, upcoming] = await Promise.all([
                    getDueReviews(userId),
                    getUpcomingReviews(userId, 7)
                ]);

                if (mounted) {
                    setDueReviews(due || []);
                    setUpcomingReviews(upcoming || []);
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
    }, [userId]);

    // Handle empty state (nothing due, nothing upcoming)
    if (!isLoading && dueReviews.length === 0 && upcomingReviews.length === 0) {
        return null;
    }

    const totalThisWeek = dueReviews.length + upcomingReviews.length;
    const progressPercent = totalThisWeek > 0
        ? Math.round((dueReviews.length / totalThisWeek) * 100)
        : 0;

    const renderDueList = () => {
        const displayLimit = 3;
        const visibleReviews = dueReviews.slice(0, displayLimit);
        const hasMore = dueReviews.length > displayLimit;

        return (
            <div className="space-y-3">
                {visibleReviews.map((review) => (
                    <div
                        key={review.problemId}
                        className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-amber-500/30 transition-colors group"
                    >
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                    review.problemDifficulty === 'easy' ? "bg-emerald-500/10 text-emerald-400" :
                                        review.problemDifficulty === 'hard' ? "bg-red-500/10 text-red-400" :
                                            "bg-blue-500/10 text-blue-400"
                                )}>
                                    {review.problemDifficulty}
                                </span>
                                <span className="text-sm font-bold text-slate-200 capitalize group-hover:text-amber-400 transition-colors">
                                    {review.problemTitle || review.problemId.replace(/-/g, ' ')}
                                </span>
                                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-500 border-amber-500/30 rounded-full h-4 px-1.5">
                                    Review Due
                                </Badge>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">Rep {review.repetitions}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-xl h-8 px-3 text-xs font-bold transition-all"
                            onClick={() => router.push(`/interview?problemId=${review.problemId}&mode=review`)}
                        >
                            Start <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                    </div>
                ))}

                {hasMore && (
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-medium text-slate-500">And {dueReviews.length - displayLimit} more</span>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-slate-400 hover:text-white"
                        >
                            <Trash2 className="w-3 h-3 mr-1.5" /> Clear Queue
                        </Button>
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
                            <h4 className="text-sm font-bold text-emerald-400">All caught up!</h4>
                            {upcomingReviews.length > 0 && (
                                <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                                    <Clock className="w-3 h-3" /> Next review: {upcomingReviews[0].nextReviewDate}
                                </p>
                            )}
                        </div>
                    ) : (
                        renderDueList()
                    )}
                </div>

                <div className="mt-auto space-y-2 pt-4 border-t border-amber-800/20">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Coming up this week: {totalThisWeek}</span>
                        <span className="font-bold text-amber-500">{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-900/50 rounded-full overflow-hidden">
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
