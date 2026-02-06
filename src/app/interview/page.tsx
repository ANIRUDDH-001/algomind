'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { useProgress } from '@/hooks/useProgress';
import { getProblemById, getRandomProblem, Problem } from '@/lib/supabase/problems';

function InterviewContent() {
    const searchParams = useSearchParams();
    const problemId = searchParams.get('problemId');
    const sessionId = searchParams.get('sessionId');
    const { history } = useProgress();

    console.log('[InterviewPage RENDER] State:', {
        problemId,
        sessionId,
        historyCount: history.length,
        hasHistory: history.length > 0
    });

    const [problem, setProblem] = useState<Problem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    const initialTranscript = session?.transcript;

    useEffect(() => {
        console.log('[InterviewPage] History updated:', history.length, 'sessions');
        console.log('[InterviewPage] SessionId:', sessionId);
        console.log('[InterviewPage] Found session:', !!session);
    }, [history, sessionId, session]);

    useEffect(() => {
        async function loadProblem() {
            setLoading(true);
            setError(null);

            try {
                let fetchedProblem: Problem | null = null;

                // First, try to get problem from sessionStorage (passed from Practice page)
                const cachedProblem = sessionStorage.getItem('currentProblem');
                console.log('🔍 [INTERVIEW DEBUG] sessionStorage cachedProblem exists:', !!cachedProblem);
                console.log('🔍 [INTERVIEW DEBUG] problemId from URL:', problemId);

                if (cachedProblem && problemId) {
                    try {
                        const parsed = JSON.parse(cachedProblem) as Problem;
                        console.log('🔍 [INTERVIEW DEBUG] Parsed problem from sessionStorage:', {
                            id: parsed.id,
                            title: parsed.title,
                            keys: Object.keys(parsed),
                            external_url: parsed.external_url,
                            hasExternalUrl: !!parsed.external_url
                        });

                        // Verify it's the right problem
                        if (parsed.id === problemId) {
                            fetchedProblem = parsed;
                            console.log('✅ [INTERVIEW DEBUG] Using problem from sessionStorage');
                        } else {
                            console.log('⚠️ [INTERVIEW DEBUG] Problem ID mismatch, will fetch from DB');
                        }
                    } catch (e) {
                        console.error('❌ [INTERVIEW DEBUG] Failed to parse sessionStorage:', e);
                        // Ignore parse errors, fall back to DB fetch
                    }
                } else {
                    console.log('⚠️ [INTERVIEW DEBUG] No cached problem or no problemId, will fetch from DB');
                }

                // Fall back to DB fetch if no cached problem
                if (!fetchedProblem) {
                    if (problemId) {
                        console.log('📡 [INTERVIEW DEBUG] Fetching from DB via getProblemById...');
                        fetchedProblem = await getProblemById(problemId);
                        if (fetchedProblem) {
                            console.log('📡 [INTERVIEW DEBUG] DB response:', {
                                id: fetchedProblem.id,
                                title: fetchedProblem.title,
                                keys: Object.keys(fetchedProblem),
                                external_url: fetchedProblem.external_url,
                                hasExternalUrl: !!fetchedProblem.external_url
                            });
                        }
                    } else {
                        console.log('📡 [INTERVIEW DEBUG] Fetching random problem from DB...');
                        fetchedProblem = await getRandomProblem();
                        if (fetchedProblem) {
                            console.log('📡 [INTERVIEW DEBUG] Random problem from DB:', {
                                id: fetchedProblem.id,
                                title: fetchedProblem.title,
                                keys: Object.keys(fetchedProblem),
                                external_url: fetchedProblem.external_url,
                                hasExternalUrl: !!fetchedProblem.external_url
                            });
                        }
                    }
                }

                if (!fetchedProblem) {
                    setError('No problems found. Please add problems to your database.');
                } else {
                    console.log('✅ [INTERVIEW DEBUG] Final problem being used:', {
                        id: fetchedProblem.id,
                        external_url: fetchedProblem.external_url
                    });
                    setProblem(fetchedProblem);
                }
            } catch (e) {
                console.error('❌ [INTERVIEW DEBUG] loadProblem error:', e);
                setError('Failed to load problem from database.');
            } finally {
                setLoading(false);
            }
        }

        loadProblem();
    }, [problemId]);


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
                    <p className="text-slate-500 text-sm">
                        Run the SQL script in Supabase to add problems to your database.
                    </p>
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
