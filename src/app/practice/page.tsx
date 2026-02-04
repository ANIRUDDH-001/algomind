'use client';

import { useState, useEffect, useMemo } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { getAllProblems, getRandomProblem, type Problem } from '@/lib/supabase/problems';
import { ProblemFilters } from '@/components/practice/ProblemFilters';
import { ProblemCard } from '@/components/practice/ProblemCard';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, Shuffle, Brain } from 'lucide-react';

export default function PracticePage() {
    const { user } = useAuth();
    const [problems, setProblems] = useState<Problem[]>([]);
    const [attemptedProblems, setAttemptedProblems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        difficulty: 'all' as 'all' | 'easy' | 'medium' | 'hard',
        attempted: 'all' as 'all' | 'attempted' | 'not-attempted',
    });
    const router = useRouter();

    useEffect(() => {
        loadProblems();
    }, []);

    useEffect(() => {
        loadAttemptedProblems();
    }, [user]);

    const loadProblems = async () => {
        setLoading(true);
        const data = await getAllProblems();
        setProblems(data);
        setLoading(false);
    };

    const loadAttemptedProblems = async () => {
        if (!user) return;

        // Load from localStorage for now
        try {
            const attempted = localStorage.getItem(`attempted_problems_${user.id}`);
            if (attempted) {
                setAttemptedProblems(new Set(JSON.parse(attempted)));
            }
        } catch (e) {
            console.error('Failed to load attempted problems:', e);
        }
    };

    // Filter problems based on criteria
    const filteredProblems = useMemo(() => {
        return problems.filter((problem) => {
            // Difficulty filter
            if (filters.difficulty !== 'all' && problem.difficulty !== filters.difficulty) {
                return false;
            }

            // Attempted filter
            const isAttempted = attemptedProblems.has(problem.id);
            if (filters.attempted === 'attempted' && !isAttempted) {
                return false;
            }
            if (filters.attempted === 'not-attempted' && isAttempted) {
                return false;
            }

            return true;
        });
    }, [problems, filters, attemptedProblems]);

    const handleStartInterview = (problemId: string) => {
        // Mark as attempted
        const newAttempted = new Set(attemptedProblems);
        newAttempted.add(problemId);
        setAttemptedProblems(newAttempted);

        if (user) {
            localStorage.setItem(
                `attempted_problems_${user.id}`,
                JSON.stringify(Array.from(newAttempted))
            );
        }

        router.push(`/interview?problemId=${problemId}`);
    };

    const handleRandomProblem = async () => {
        const problem = await getRandomProblem(
            filters.difficulty !== 'all' ? filters.difficulty : undefined
        );
        if (problem) {
            handleStartInterview(problem.id);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <div className="min-h-screen flex items-center justify-center bg-slate-950">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                        <p className="text-slate-400 text-sm">Loading problems...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-950 pt-20 pb-12 px-4">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-4xl font-black text-white mb-2">
                                Practice Problems
                            </h1>
                            <p className="text-slate-400">
                                {filteredProblems.length} problem{filteredProblems.length !== 1 ? 's' : ''} available
                                {filters.difficulty !== 'all' && ` • ${filters.difficulty}`}
                                {filters.attempted !== 'all' && ` • ${filters.attempted.replace('-', ' ')}`}
                            </p>
                        </div>
                        <Button
                            onClick={handleRandomProblem}
                            disabled={filteredProblems.length === 0}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-blue-900/20"
                        >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Random Problem
                        </Button>
                    </div>

                    {/* Filters */}
                    <ProblemFilters onFilterChange={setFilters} />

                    {/* Problems List */}
                    {problems.length === 0 ? (
                        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                            <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg mb-2">No problems found in database</p>
                            <p className="text-slate-500 text-sm">
                                Run the SQL script in Supabase to add problems
                            </p>
                        </div>
                    ) : filteredProblems.length === 0 ? (
                        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                            <p className="text-slate-400 text-lg mb-4">No problems match your filters</p>
                            <Button
                                onClick={() => setFilters({ difficulty: 'all', attempted: 'all' })}
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredProblems.map((problem) => (
                                <ProblemCard
                                    key={problem.id}
                                    problem={problem}
                                    attempted={attemptedProblems.has(problem.id)}
                                    onStart={handleStartInterview}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
