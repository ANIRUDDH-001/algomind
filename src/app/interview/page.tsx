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

    const [problem, setProblem] = useState<Problem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Find session if viewing history
    const session = sessionId ? history.find(s => s.sessionId === sessionId) : null;
    const initialTranscript = session?.transcript;

    useEffect(() => {
        async function loadProblem() {
            setLoading(true);
            setError(null);

            try {
                let fetchedProblem: Problem | null = null;

                // First, try to get problem from sessionStorage (passed from Practice page)
                const cachedProblem = sessionStorage.getItem('currentProblem');
                if (cachedProblem && problemId) {
                    try {
                        const parsed = JSON.parse(cachedProblem) as Problem;
                        console.log('[DEBUG] Read problem from sessionStorage:', {
                            id: parsed.id,
                            keys: Object.keys(parsed),
                            external_url: parsed.external_url
                        });

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

                if (!fetchedProblem) {
                    setError('No problems found. Please add problems to your database.');
                } else {
                    setProblem(fetchedProblem);
                }
            } catch (e) {
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
