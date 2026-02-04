'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { getProblemById, getRandomProblem, Problem } from '@/lib/supabase/problems';

function InterviewContent() {
    const searchParams = useSearchParams();
    const problemId = searchParams.get('problemId');
    const [problem, setProblem] = useState<Problem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadProblem() {
            setLoading(true);
            setError(null);

            try {
                let fetchedProblem: Problem | null = null;

                if (problemId) {
                    fetchedProblem = await getProblemById(problemId);
                } else {
                    fetchedProblem = await getRandomProblem();
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
            <InterviewSession problem={problem} />
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
