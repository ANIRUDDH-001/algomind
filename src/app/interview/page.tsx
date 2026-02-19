'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { useProgress } from '@/hooks/useProgress';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProblemById, getRandomProblem, Problem } from '@/lib/supabase/problems';
import { getGuestProblem } from '@/lib/guest/guest-problems';
import { checkUserRateLimit } from '@/lib/rate-limit/user-rate-limiter';

function InterviewContent() {
    const searchParams = useSearchParams();
    const problemId = searchParams.get('problemId');
    const sessionId = searchParams.get('sessionId');
    const { history } = useProgress();
    const { user } = useAuth();

    const isGuest = !user;
    const userId = user?.id || null;

    // console.log('[InterviewPage RENDER] State:', { ... });

    const [problem, setProblem] = useState<(Problem & { ragContext?: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; remaining: number } | null>(null);

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    const initialTranscript = session?.transcript;

    useEffect(() => {
        // console.log('[InterviewPage] History updated:', history.length, 'sessions');
    }, [history, sessionId, session]);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);

            try {
                // Parallel data fetching for better performance
                const promises: Promise<any>[] = [];

                // 1. Rate Limit Check (Authenticated users only, not history view)
                if (!sessionId && userId) {
                    promises.push(checkUserRateLimit(userId));
                } else {
                    promises.push(Promise.resolve(null)); // Placeholder
                }

                // 2. Fetch Problem
                if (isGuest && !sessionId) {
                    // Guest: Use hardcoded problem (instant)
                    promises.push(Promise.resolve(getGuestProblem()));
                } else {
                    // Authenticated: Fetch from DB or Cache
                    const cachedProblem = sessionStorage.getItem('currentProblem');
                    if (cachedProblem && problemId) {
                        try {
                            const parsed = JSON.parse(cachedProblem) as Problem;
                            if (parsed.id === problemId) {
                                promises.push(Promise.resolve(parsed));
                            } else {
                                // Cache mismatch, fetch fresh
                                promises.push(problemId ? getProblemById(problemId) : getRandomProblem());
                            }
                        } catch (e) {
                            promises.push(problemId ? getProblemById(problemId) : getRandomProblem());
                        }
                    } else {
                        promises.push(problemId ? getProblemById(problemId) : getRandomProblem());
                    }
                }

                // Wait for all data
                const [rateLimitData, fetchedProblem] = await Promise.all(promises);

                // Handle Rate Limit Result
                if (rateLimitData) {
                    setRateLimitInfo(rateLimitData);
                    if (!rateLimitData.allowed) {
                        setError(`Daily limit reached (${rateLimitData.remaining}/5 questions). Try again tomorrow!`);
                        setLoading(false);
                        return;
                    }
                }

                // Handle Problem Result
                if (!fetchedProblem) {
                    setError('No problems found. Please add problems to your database.');
                } else {
                    setProblem(fetchedProblem);
                }

            } catch (e) {
                console.error('Failed to load interview data:', e);
                setError('Failed to load problem. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [problemId, isGuest, userId, sessionId]);


    if (loading) {
        return (
            <div className="fixed inset-0 top-16 bg-slate-950 flex flex-col lg:flex-row p-4 gap-4 animate-pulse">
                {/* Desktop Skeleton Layout */}
                <div className="hidden lg:flex w-1/4 h-full bg-slate-900/50 rounded-xl border border-slate-800/50 flex-col p-4 gap-4">
                    <div className="h-6 w-3/4 bg-slate-800 rounded"></div>
                    <div className="h-4 w-1/2 bg-slate-800 rounded"></div>
                    <div className="flex-1 bg-slate-800/30 rounded-lg"></div>
                </div>
                <div className="hidden lg:flex w-1/2 h-full bg-slate-900/50 rounded-xl border border-slate-800/50 flex-col p-8 items-center justify-center gap-6">
                    <div className="w-32 h-32 rounded-full bg-slate-800/50"></div>
                    <div className="h-8 w-64 bg-slate-800 rounded"></div>
                </div>
                <div className="hidden lg:flex w-1/4 h-full bg-slate-900/50 rounded-xl border border-slate-800/50"></div>

                {/* Mobile Skeleton Layout */}
                <div className="lg:hidden flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-slate-800/50"></div>
                    <div className="h-6 w-48 bg-slate-800 rounded"></div>
                    <p className="text-slate-500 text-sm">Preparing Session...</p>
                </div>
            </div>
        );
    }

    if (error || !problem) {
        return (
            <div className="fixed inset-0 top-16 bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center max-w-md px-6">
                    <p className="text-red-400 text-lg mb-4">{error || 'Problem not found'}</p>
                    {rateLimitInfo && !rateLimitInfo.allowed ? (
                        <p className="text-slate-500 text-sm">
                            You&apos;ve used all your daily questions. Come back tomorrow!
                        </p>
                    ) : (
                        <p className="text-slate-500 text-sm">
                            Run the SQL script in Supabase to add problems to your database.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 top-16 bg-slate-950 text-slate-100 overflow-hidden">
            <InterviewSession
                problem={problem}
                initialTranscript={initialTranscript}
                readOnly={!!sessionId}
                isGuest={isGuest}
                ragContext={problem.ragContext}
                remainingQuestions={rateLimitInfo?.remaining}
            />
        </div>
    );
}

export default function InterviewPage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 top-16 bg-slate-950" />}>
            <InterviewContent />
        </Suspense>
    );
}
