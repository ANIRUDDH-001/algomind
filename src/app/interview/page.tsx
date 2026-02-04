'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { getProblemById, getRandomProblem } from '@/lib/data/problems';

function InterviewContent() {
    const searchParams = useSearchParams();
    const problemId = searchParams.get('problemId');
    const [problem, setProblem] = React.useState<any>(null);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => {
        setIsMounted(true);
        if (problemId) {
            setProblem(getProblemById(problemId));
        } else {
            setProblem(getRandomProblem());
        }
    }, [problemId]);

    if (!isMounted || !problem) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-8 w-48 bg-slate-800 rounded"></div>
                    <p className="text-slate-500 text-sm">Initializing Session...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-950 text-slate-100 overflow-y-auto">
            <InterviewSession
                problemId={problem.id}
                title={problem.title}
                content={problem.description}
            />
        </div>
    );
}

export default function InterviewPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
            <InterviewContent />
        </Suspense>
    );
}
