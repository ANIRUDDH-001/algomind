'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { getAllProblems, getRandomProblem, type Problem } from '@/lib/supabase/problems';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, Shuffle, Play } from 'lucide-react';

export default function PracticePage() {
    const [problems, setProblems] = useState<Problem[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadProblems();
    }, []);

    const loadProblems = async () => {
        setLoading(true);
        const data = await getAllProblems();
        setProblems(data);
        setLoading(false);
    };

    const handleStartInterview = (problemId: string) => {
        router.push(`/interview?problemId=${problemId}`);
    };

    const handleRandomProblem = async () => {
        const problem = await getRandomProblem();
        if (problem) {
            handleStartInterview(problem.id);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-slate-950">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 pt-20 pb-12 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-4xl font-bold text-white">Choose a Problem</h1>
                        <Button
                            onClick={handleRandomProblem}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                        >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Random Problem
                        </Button>
                    </div>

                    {problems.length === 0 ? (
                        <div className="text-center py-16">
                            <p className="text-slate-400 text-lg mb-4">No problems found in database.</p>
                            <p className="text-slate-500 text-sm">
                                Add problems via Supabase SQL Editor using the create_problems_table.sql script.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {problems.map((problem) => (
                                <div
                                    key={problem.id}
                                    className="bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-xl font-semibold text-white">
                                                    {problem.title}
                                                </h3>
                                                <span
                                                    className={`px-2 py-1 rounded text-xs font-medium ${problem.difficulty === 'easy'
                                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : problem.difficulty === 'medium'
                                                            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                        }`}
                                                >
                                                    {problem.difficulty}
                                                </span>
                                            </div>
                                            <p className="text-slate-400 line-clamp-2 mb-3">
                                                {problem.description}
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {problem.tags.map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="px-2 py-1 bg-slate-800 text-slate-400 rounded text-xs border border-slate-700"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleStartInterview(problem.id)}
                                            className="ml-4 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            Start
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
