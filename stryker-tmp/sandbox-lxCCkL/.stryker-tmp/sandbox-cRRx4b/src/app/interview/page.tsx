/**
 * @codesage
 * @file      src/app/interview/page.tsx
 * @purpose   Main interview page component handling problem loading, rate limiting, and config resolution.
 * @tech      React, Next.js, Supabase
 * @connects  InterviewSession, InterviewErrorBoundary, useProgress, useAuth
 * @apis      /api/rag/context
 * @db        profiles
 * @state     problem, interviewConfig, loading, error, rateLimitInfo, userTtsProvider
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

//  -- automated unused local suppression
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
import { checkCoOwnerStatus } from '@/app/actions/co-owner';
import { getSupabase } from '@/lib/supabase/client';
import { prefetchVADAssets } from '@/lib/voice/vad-manager';
import { useGlobalFeatureFlag } from '@/hooks/useGlobalFeatureFlag';

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
    const guestModeEnabled = useGlobalFeatureFlag('ENABLE_GUEST_MODE', true);

    const isGuest = !user && guestModeEnabled;
    const userId = user?.id || null;

    // console.log('[InterviewPage RENDER] State:', { ... });

    const [problem, setProblem] = useState<(Problem & { ragContext?: string }) | null>(null);
    const [interviewConfig, setInterviewConfig] = useState<InterviewConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rateLimitInfo, setRateLimitInfo] = useState<{ allowed: boolean; remaining: number } | null>(null);
    const [userTtsProvider, setUserTtsProvider] = useState<'auto' | 'polly' | 'browser'>('auto');

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    //  -- automated unused local suppression
    const initialTranscript = session?.transcript;

    useEffect(() => {
        // console.log('[InterviewPage] History updated:', history.length, 'sessions');
    }, [history, sessionId, session]);



    useEffect(() => {
        prefetchVADAssets();
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

                // Wait for rate limit + problem first — everything else depends on fetchedProblem or userId.
                const [rateLimitData, fetchedProblem] = await Promise.all([rateLimitPromise, problemPromise]);

                // ── Parallelise the remaining fetches ────────────────────────────
                // Profile / kaiMemory / co-owner status / RAG context have no
                // cross-dependency (RAG needs fetchedProblem which is resolved here).
                // Running them concurrently saves ~300–500ms vs. the previous
                // sequential awaits.
                const supabase = getSupabase();

                const profileFetch: Promise<{ account_type: string; rate_limit_override: number | null } | null> =
                    (userId && !isGuest && supabase)
                        ? Promise.resolve(
                            supabase
                                .from('profiles')
                                .select('account_type, rate_limit_override')
                                .eq('id', userId)
                                .single()
                          ).then(({ data }) => (data as { account_type: string; rate_limit_override: number | null } | null) ?? null)
                        : Promise.resolve(null);

                const ragFetch: Promise<string> = (fetchedProblem && !isGuest)
                    ? (async () => {
                        try {
                            const query = `${fetchedProblem.title} ${fetchedProblem.description}`.slice(0, 500);
                            const res = await fetch('/api/rag/context', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ query }),
                            });
                            if (!res.ok) return '';
                            const { chunks } = await res.json();
                            if (!Array.isArray(chunks) || chunks.length === 0) return '';
                            return chunks
                                .map((r: any) => `### ${r.title ?? ''}\n${r.content ?? ''}`)
                                .join('\n\n---\n\n');
                        } catch (e) {
                            console.warn('[RAG] Failed to fetch context — proceeding without it:', e);
                            return '';
                        }
                    })()
                    : Promise.resolve(
                        (isGuest && fetchedProblem)
                            ? ((fetchedProblem as typeof fetchedProblem & { ragContext?: string }).ragContext ?? '')
                            : ''
                    );

                const kaiMemoryFetch: Promise<string> = (userId && !isGuest)
                    ? getKaiMemory(userId)
                        .then(r => (r.success ? r.data.memory : ''))
                        .catch(() => '')
                    : Promise.resolve('');

                // Co-owner check gated on being a candidate; we can't know that until profile resolves.
                // Still parallelise: kick off co-owner speculatively whenever userId && !isGuest,
                // then gate its value later against profile.account_type.
                const coOwnerFetch: Promise<boolean> = (userId && !isGuest)
                    ? checkCoOwnerStatus(userId)
                        .then(r => (r.success ? r.data.isCoOwner : false))
                        .catch(() => false)
                    : Promise.resolve(false);

                const [profileResult, ragContext, kaiMemory, coOwnerSpeculative] = await Promise.all([
                    profileFetch,
                    ragFetch,
                    kaiMemoryFetch,
                    coOwnerFetch,
                ]);
                const profile = profileResult;
                // Only candidates actually use isCoOwner; owners/admins are unlimited.
                const isCoOwner = profile?.account_type === 'candidate' ? coOwnerSpeculative : false;

                // ── Sprint: fetch problem 2 if needed ────────────────────────────────────────
                let sprintProblemIds: [string, string] | undefined;
                if (difficultyMode === 'sprint' && fetchedProblem && !isGuest) {
                    const p2IdParam = searchParams.get('p2Id');
                    try {
                        const p2 = p2IdParam
                            ? await getProblemById(p2IdParam)
                            : await getRandomProblem(fetchedProblem.difficulty);
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
                
                // Fetch TTS Prefs
                if (userId) {
                    import('@/lib/supabase/user-preferences').then(({ getUserPreferences }) => {
                        getUserPreferences(userId).then(prefs => {
                            setUserTtsProvider(prefs.ttsProvider ?? 'auto');
                        }).catch(() => {});
                    });
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
            <div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] flex flex-col lg:flex-row p-4 gap-4 animate-pulse">
                {/* Desktop Skeleton Layout */}
                <div className="hidden lg:flex w-1/4 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10 flex-col p-4 gap-4">
                    <div className="h-6 w-3/4 bg-[var(--surface-2)] rounded"></div>
                    <div className="h-4 w-1/2 bg-[var(--surface-2)] rounded"></div>
                    <div className="flex-1 bg-[var(--surface-2)]/30 rounded-lg"></div>
                </div>
                <div className="hidden lg:flex w-1/2 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10 flex-col p-8 items-center justify-center gap-6">
                    <div className="w-32 h-32 rounded-full bg-[var(--surface-2)]/50"></div>
                    <div className="h-8 w-64 bg-[var(--surface-2)] rounded"></div>
                </div>
                <div className="hidden lg:flex w-1/4 h-full bg-[var(--surface-1)]/50 rounded-xl border border-white/10"></div>

                {/* Mobile Skeleton Layout */}
                <div className="lg:hidden flex-1 flex flex-col items-center justify-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-[var(--surface-2)]/50"></div>
                    <div className="h-6 w-48 bg-[var(--surface-2)] rounded"></div>
                    <p className="text-zinc-500 text-sm">Preparing Session...</p>
                </div>
            </div>
        );
    }

    if (error || !problem) {
        return (
            <div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] flex items-center justify-center text-white">
                <div className="text-center max-w-md px-6">
                    <p className="text-red-400 text-lg mb-4">{error || 'Problem not found'}</p>
                    {rateLimitInfo && !rateLimitInfo.allowed ? (
                        <p className="text-zinc-500 text-sm">
                            You&apos;ve used all your daily questions. Come back tomorrow!
                        </p>
                    ) : (
                        <p className="text-zinc-500 text-sm">
                            Run the SQL script in Supabase to add problems to your database.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (!user && !guestModeEnabled) {
        return (
            <div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] flex items-center justify-center text-white">
                <div className="text-center max-w-md px-6">
                    <p className="text-amber-400 text-lg mb-4">Guest mode is currently disabled.</p>
                    <p className="text-zinc-500 text-sm">Please sign in to continue your interview practice.</p>
                </div>
            </div>
        );
    }

    const backHref = '/dashboard';

    return (
        <div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] text-zinc-100 overflow-hidden">
            <BrowserCompatBanner />
            <InterviewErrorBoundary>
                {problem && interviewConfig && (
                    <InterviewSession
                        problem={problem}
                        interviewConfig={interviewConfig}
                        readOnly={!!sessionId}
                        isGuest={isGuest}
                        isReviewMode={isReviewMode}
                        backHref={backHref}
                        userTtsProvider={userTtsProvider}
                    />
                )}
            </InterviewErrorBoundary>
        </div>
    );
}

export default function InterviewPage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 top-[var(--navbar-h)] bg-[var(--surface-base)] overflow-hidden" />}>
            <InterviewContent />
        </Suspense>
    );
}
