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

    console.log('[InterviewPage RENDER] State:', {
        problemId,
        sessionId,
        historyCount: history.length,
        hasHistory: history.length > 0,
        isGuest
    });

    const [problem, setProblem] = useState<(Problem & { ragContext?: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; remaining: number } | null>(null);

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    const initialTranscript = session?.transcript;

    useEffect(() => {
        console.log('[InterviewPage] History updated:', history.length, 'sessions');
        console.log('[InterviewPage] SessionId:', sessionId);
        console.log('[InterviewPage] Found session:', !!session);
    }, [history, sessionId, session]);

    useEffect(() => {
        async function loadProblemAndCheckLimits() {
            setLoading(true);
            setError(null);

            try {
                // Check rate limit for authenticated users (not for viewing history)
                if (!sessionId && userId) {
                    const rateLimit = await checkUserRateLimit(userId);
                    setRateLimitInfo(rateLimit);

                    if (!rateLimit.allowed) {
                        setError(`Daily limit reached (${rateLimit.remaining}/5 questions). Try again tomorrow!`);
                        setLoading(false);
                        return;
                    }
                }

                let fetchedProblem: (Problem & { ragContext?: string }) | null = null;

                // GUEST USERS: Use hardcoded sample problems (no DB required)
                if (isGuest && !sessionId) {
                    console.log('[InterviewPage] Guest user - using sample problem');
                    const guestProblem = getGuestProblem();
                    fetchedProblem = guestProblem;
                } else {
                    // AUTHENTICATED USERS: Fetch from DB

                    // First, try to get problem from sessionStorage (passed from Practice page)
                    const cachedProblem = sessionStorage.getItem('currentProblem');

                    if (cachedProblem && problemId) {
                        try {
                            const parsed = JSON.parse(cachedProblem) as Problem;
                            // Verify it's the right problem
                            if (parsed.id === problemId) {
                                fetchedProblem = parsed;
                            }
                        } catch (e) {
                            // Ignore parse errors, fall back to DB fetch
                        }
                    }

                    // Fall back to DB fetch if no cached problem
                    if (!fetchedProblem) {
                        if (problemId) {
                            fetchedProblem = await getProblemById(problemId);
                        } else {
                            fetchedProblem = await getRandomProblem();
                        }
                    }
                }

                if (!fetchedProblem) {
                    setError('No problems found. Please add problems to your database.');
                } else {
                    setProblem(fetchedProblem);
                }
            } catch (e) {
                console.error('Failed to load problem:', e);
                setError('Failed to load problem from database.');
            } finally {
                setLoading(false);
            }
        }

        loadProblemAndCheckLimits();
    }, [problemId, isGuest, userId, sessionId]);


    if (loading) {
        return (
            <div className="fixed inset-0 top-16 bg-slate-950 flex items-center justify-center text-white">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-8 w-48 bg-slate-800 rounded"></div>
                    <p className="text-slate-500 text-sm">Loading Problem...</p>
                </div>
            </div>
        );
    }

    if (error || !problem) {
        return (
            <div className="fixed inset-0 top-16 bg-slate-950 flex items-center justify-center text-white">
                <div className="text-center max-w-md px-6">
                    <p className="text-red-400 text-lg mb-4">{error || 'Problem not found'}</p>
                    {!rateLimitInfo?.allowed ? (
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
