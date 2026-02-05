'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProblemsPaginated, getRandomProblem, type Problem } from '@/lib/supabase/problems';
import { ProblemFilters, CURATED_LISTS } from '@/components/practice/ProblemFilters';
import { ProblemCard } from '@/components/practice/ProblemCard';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, Shuffle, Brain, ChevronLeft, ChevronRight } from 'lucide-react';

const PROBLEMS_PER_PAGE = 15;

export default function PracticePage() {
    const { user } = useAuth();
    const router = useRouter();

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    // Problems state
    const [problems, setProblems] = useState<Problem[]>([]);
    const [attemptedProblems, setAttemptedProblems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Filters state
    const [filters, setFilters] = useState({
        difficulty: 'all' as 'all' | 'easy' | 'medium' | 'hard',
        curatedList: '',
    });

    // Load problems when filters or page changes
    const loadProblems = useCallback(async () => {
        setLoading(true);
        const result = await getProblemsPaginated(currentPage, PROBLEMS_PER_PAGE, {
            difficulty: filters.difficulty !== 'all' ? filters.difficulty : undefined,
            curatedList: filters.curatedList || undefined,
        });
        setProblems(result.problems);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
        setLoading(false);
    }, [currentPage, filters]);

    useEffect(() => {
        loadProblems();
    }, [loadProblems]);

    useEffect(() => {
        loadAttemptedProblems();
    }, [user]);

    const loadAttemptedProblems = async () => {
        if (!user) return;
        try {
            const attempted = localStorage.getItem(`attempted_problems_${user.id}`);
            if (attempted) {
                setAttemptedProblems(new Set(JSON.parse(attempted)));
            }
        } catch (e) {
            console.error('Failed to load attempted problems:', e);
        }
    };

    // Reset to page 1 when filters change
    const handleFilterChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        setCurrentPage(1);
    };

    const handleStartInterview = (problemId: string) => {
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

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Get current curated list label
    const currentListLabel = CURATED_LISTS.find(l => l.value === filters.curatedList)?.label || 'All Problems';

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
                                {totalCount} problem{totalCount !== 1 ? 's' : ''}
                                {filters.curatedList && ` in ${currentListLabel}`}
                                {filters.difficulty !== 'all' && ` • ${filters.difficulty}`}
                            </p>
                        </div>
                        <Button
                            onClick={handleRandomProblem}
                            disabled={problems.length === 0}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-blue-900/20"
                        >
                            <Shuffle className="w-4 h-4 mr-2" />
                            Random Problem
                        </Button>
                    </div>

                    {/* Filters */}
                    <ProblemFilters onFilterChange={handleFilterChange} currentFilters={filters} />

                    {/* Loading State */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                                <p className="text-slate-400 text-sm">Loading problems...</p>
                            </div>
                        </div>
                    ) : problems.length === 0 ? (
                        <div className="text-center py-16 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                            <Brain className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg mb-2">No problems found</p>
                            <p className="text-slate-500 text-sm mb-4">
                                Try changing your filters or add more problems to the database
                            </p>
                            <Button
                                onClick={() => handleFilterChange({ difficulty: 'all', curatedList: '' })}
                                variant="outline"
                                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                            >
                                Clear Filters
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Problems List */}
                            <div className="space-y-4">
                                {problems.map((problem) => (
                                    <ProblemCard
                                        key={problem.id}
                                        problem={problem}
                                        attempted={attemptedProblems.has(problem.id)}
                                        onStart={handleStartInterview}
                                    />
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-center gap-4 mt-8 pt-8 border-t border-slate-800">
                                    <Button
                                        onClick={() => goToPage(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        variant="outline"
                                        className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4 mr-1" />
                                        Previous
                                    </Button>

                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 text-sm">
                                            Page <span className="font-bold text-white">{currentPage}</span> of <span className="font-bold text-white">{totalPages}</span>
                                        </span>
                                    </div>

                                    <Button
                                        onClick={() => goToPage(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        variant="outline"
                                        className="border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        Next
                                        <ChevronRight className="w-4 h-4 ml-1" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
