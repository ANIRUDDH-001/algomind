'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { InterviewErrorBoundary } from '@/components/interview/InterviewErrorBoundary';
import { useProgress } from '@/hooks/useProgress';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProblemById, getRandomProblem, Problem } from '@/lib/supabase/problems';
import { getGuestProblem, getGuestProblemById } from '@/lib/guest/guest-problems';
import { checkUserRateLimit, type RateLimitResult } from '@/lib/rate-limit/user-rate-limiter';
import { BrowserCompatBanner } from '@/components/interview/BrowserCompatBanner';
import { resolveGuestConfig, resolvePracticeConfig, type InterviewConfig } from '@/lib/interview/interview-config';
import { getKaiMemory } from '@/app/actions/learn';
import { getSupabase } from '@/lib/supabase/client';

function InterviewContent() {
    const searchParams = useSearchParams();
    const problemId = searchParams.get('problemId');
    const sessionId = searchParams.get('sessionId');
    const mode = searchParams.get('mode');
    const isReviewMode = mode === 'review';
    const difficultyMode = (['warm-up', 'practice', 'crunch', 'sprint'].includes(mode ?? ''))
        ? mode as 'warm-up' | 'practice' | 'crunch' | 'sprint'
        : 'practice';
    const { history } = useProgress();
    const { user } = useAuth();

    const isGuest = !user;
    const userId = user?.id || null;

    // console.log('[InterviewPage RENDER] State:', { ... });

    const [problem, setProblem] = useState<(Problem & { ragContext?: string }) | null>(null);
    const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; remaining: number } | null>(null);

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    const initialTranscript = session?.transcript;

    useEffect(() => {
        // console.log('[InterviewPage] History updated:', history.length, 'sessions');
    }, [history, sessionId, session]);

    // One-time eviction of stale panel layout saved under the old group id.
    // The group id was removed so the library no longer persists sizes, but
    // any browser that visited before still has the old 24/52/24 layout cached.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const STALE_KEY = 'react-resizable-panels:interview_panels_v2';
        if (localStorage.getItem(STALE_KEY) !== null) {
            localStorage.removeItem(STALE_KEY);
        }
    }, []);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            setError(null);

            try {
                // Parallel data fetching for better performance
                // 1. Rate Limit Check (Authenticated users only, not history view)
                const rateLimitPromise: Promise<RateLimitResult | null> =
                    (!sessionId && userId) ? checkUserRateLimit(userId) : Promise.resolve(null);

                // 2. Fetch Problem
                let problemPromise: Promise<Problem | null>;
                if (isGuest && !sessionId) {
                    const guestProblemId = searchParams.get('guestProblemId');
                    if (guestProblemId) {
                        // Deep link to a specific problem (e.g., from "Try Another" redirect)
                        const specific = getGuestProblemById(guestProblemId);
                        problemPromise = Promise.resolve(specific ?? getGuestProblem());
                    } else {
                        // No pre-selection: load random. Selector in InterviewSession will override.
                        problemPromise = Promise.resolve(getGuestProblem());
                    }
                } else {
                    // Authenticated: Fetch from DB or Cache
                    const cachedProblem = sessionStorage.getItem('currentProblem');
                    if (cachedProblem && problemId) {
                        try {
                            const parsed = JSON.parse(cachedProblem) as Problem;
                            if (parsed.id === problemId) {
                                problemPromise = Promise.resolve(parsed);
                            } else {
                                problemPromise = problemId ? getProblemById(problemId) : getRandomProblem();
                            }
                        } catch {
                            problemPromise = problemId ? getProblemById(problemId) : getRandomProblem();
                        }
                    } else {
                        problemPromise = problemId ? getProblemById(problemId) : getRandomProblem();
                    }
                }

                // Wait for all data
                const [rateLimitData, fetchedProblem] = await Promise.all([rateLimitPromise, problemPromise]);

                // Fetch profile for authenticated users
                const supabase = getSupabase();
                let profile: { account_type: string; rate_limit_override: number | null } | null = null;
                if (userId && !isGuest && supabase) {
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('account_type, rate_limit_override')
                        .eq('id', userId)
                        .single();
                    profile = profileData;
                }

                // ── RAG: fetch ONCE for this problem ─────────────────────────────────────────
                let ragContext = '';
                if (fetchedProblem && !isGuest) {
                    try {
                        const { supabaseHybridSearch } = await import('@/lib/rag/supabaseVectorStore');
                        const query = `${fetchedProblem.title} ${fetchedProblem.description}`.slice(0, 500);
                        let chunks: any[] = [];
                        if (supabase) {
                            chunks = await supabaseHybridSearch(supabase, query, 3);
                        }
                        if (Array.isArray(chunks) && chunks.length > 0) {
                            ragContext = chunks
                                .map((r: any) => `### ${r.chunk?.title ?? ''}\n${r.chunk?.content ?? ''}`)
                                .join('\n\n---\n\n');
                        }
                    } catch (e) {
                        console.warn('[RAG] Failed to fetch context — proceeding without it:', e);
                    }
                } else if (isGuest && fetchedProblem) {
                    ragContext = (fetchedProblem as typeof fetchedProblem & { ragContext?: string }).ragContext ?? '';
                }

                // ── Kai memory: fetch ONCE ────────────────────────────────────────────────────
                let kaiMemory = '';
                if (userId && !isGuest) {
                    try { kaiMemory = await getKaiMemory(userId); } catch { /* non-fatal */ }
                }

                // ── Co-owner check ────────────────────────────────────────────────────────────
                let isCoOwner = false;
                if (userId && !isGuest && profile?.account_type === 'candidate' && supabase) {
                    // Only check for candidates — owners/admins already have unlimited access
                    const { data: co } = await supabase.from('co_owners').select('id').eq('user_id', userId).maybeSingle();
                    isCoOwner = !!co;
                }

                // ── Sprint: fetch problem 2 if needed ────────────────────────────────────────
                let sprintProblemIds: [string, string] | undefined;
                if (difficultyMode === 'sprint' && fetchedProblem && !isGuest) {
                    try {
                        const p2 = await getRandomProblem(fetchedProblem.difficulty);
                        if (p2 && p2.id !== fetchedProblem.id) sprintProblemIds = [fetchedProblem.id, p2.id];
                    } catch { /* single-problem sprint if this fails */ }
                }

                // ── Resolve config ────────────────────────────────────────────────────────────
                const resolvedConfig: InterviewConfig = isGuest
                    ? resolveGuestConfig()
                    : resolvePracticeConfig({
                        accountType: profile?.account_type ?? 'candidate',
                        isCoOwner,
                        rateOverride: profile?.rate_limit_override ?? null,
                        difficultyMode,
                        ragContext,
                        kaiMemory,
                        sprintProblemIds,
                    });

                setProblem(fetchedProblem);
                setInterviewConfig(resolvedConfig);

                // Handle Rate Limit Result
                if (rateLimitData) {
                    setRateLimitInfo(rateLimitData);
                    // Admin users bypass rate limits entirely
                    if (!rateLimitData.allowed && !rateLimitData.isAdmin) {
                        setError(`Daily limit reached (${rateLimitData.remaining}/5 questions). Try again tomorrow!`);
                        setLoading(false);
                        return;
                    }
                }

                // Handle Problem Result
                if (!fetchedProblem) {
                    setError('No problems found. Please add problems to your database.');
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
            <div className="fixed inset-0 top-[var(--navbar-h)] bg-slate-950 flex flex-col lg:flex-row p-4 gap-4 animate-pulse">
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
            <div className="fixed inset-0 top-[var(--navbar-h)] bg-slate-950 flex items-center justify-center text-white">
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
        <div className="fixed inset-0 top-[var(--navbar-h)] bg-slate-950 text-slate-100 overflow-hidden">
            <BrowserCompatBanner />
            <InterviewErrorBoundary>
                {problem && interviewConfig && (
                    <InterviewSession
                        problem={problem}
                        interviewConfig={interviewConfig}
                        readOnly={!!sessionId}
                        isGuest={isGuest}
                        isReviewMode={isReviewMode}
                    />
                )}
            </InterviewErrorBoundary>
        </div>
    );
}

export default function InterviewPage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 top-[var(--navbar-h)] bg-slate-950 overflow-hidden" />}>
            <InterviewContent />
        </Suspense>
    );
}