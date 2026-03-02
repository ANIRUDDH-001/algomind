/* eslint-disable react-hooks/purity */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProblemsPaginated, getRandomProblem, type Problem } from '@/lib/supabase/problems';
import { ProblemFilters, CURATED_LISTS } from '@/components/practice/ProblemFilters';
import { ProblemCard } from '@/components/practice/ProblemCard';
import { DifficultyModeSelector, type DifficultyMode } from '@/components/practice/DifficultyModeSelector';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Loader2, Shuffle, Brain, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { enableDemoMode } from '@/lib/demo/manager';

const PROBLEMS_PER_PAGE = 10;

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
        attempted: 'all' as 'all' | 'attempted' | 'not-attempted',
        searchQuery: '',
        topic: '',
    });

    // Difficulty mode state
    const [difficultyMode, setDifficultyMode] = useState<DifficultyMode>('practice');

    // Load problems when filters or page changes
    const loadProblems = useCallback(async () => {
        setLoading(true);

        if (!user) {
            // Guest Mode - no problem list available
            setProblems([]);
            setTotalPages(0);
            setTotalCount(0);
            setLoading(false);
            return;
        }

        const result = await getProblemsPaginated(currentPage, PROBLEMS_PER_PAGE, {
            difficulty: filters.difficulty !== 'all' ? filters.difficulty : undefined,
            curatedList: filters.curatedList || undefined,
            searchQuery: filters.searchQuery || undefined,
            topic: filters.topic || undefined,
        });
        setProblems(result.problems);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
        setLoading(false);
    }, [currentPage, filters.difficulty, filters.curatedList, filters.searchQuery, filters.topic, user]);

    useEffect(() => {
        loadProblems();
    }, [loadProblems]);

    const loadAttemptedProblems = useCallback(async () => {
        if (!user || !isSupabaseConfigured()) return;
        try {
            const supabase = getSupabase();
            if (!supabase) return;
            const { data } = await supabase
                .from('interview_sessions')
                .select('problem_id')
                .eq('user_id', user.id);
            if (data) {
                setAttemptedProblems(new Set(data.map((d: { problem_id: string }) => d.problem_id)));
            }
        } catch {
            // Non-critical — fail silently
        }
    }, [user]);

    useEffect(() => {
        loadAttemptedProblems();
    }, [loadAttemptedProblems]);

    // Filter by attempted status (client-side since it's local data)
    const displayedProblems = useMemo(() => {
        if (filters.attempted === 'all') return problems;
        return problems.filter(p => {
            const isAttempted = attemptedProblems.has(p.id);
            if (filters.attempted === 'attempted') return isAttempted;
            if (filters.attempted === 'not-attempted') return !isAttempted;
            return true;
        });
    }, [problems, filters.attempted, attemptedProblems]);

    // Reset to page 1 when filters change
    const handleFilterChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        if (
            newFilters.difficulty !== filters.difficulty ||
            newFilters.curatedList !== filters.curatedList ||
            newFilters.searchQuery !== filters.searchQuery ||
            newFilters.topic !== filters.topic
        ) {
            setCurrentPage(1);
        }
    };

    const handleStartInterview = (problemId: string, problem?: Problem) => {
        // Optimistically mark as attempted in local state
        const newAttempted = new Set(attemptedProblems);
        newAttempted.add(problemId);
        setAttemptedProblems(newAttempted);

        // Store full problem in sessionStorage for Interview page to use
        if (problem) {
            sessionStorage.setItem('currentProblem', JSON.stringify(problem));
        }

        if (!user) {
            enableDemoMode();
            router.push(`/interview?problemId=${problemId}&demo=true`);
        } else {
            router.push(`/interview?problemId=${problemId}&mode=${difficultyMode}`);
        }
    };

    const handleRandomProblem = async () => {
        // Different random logic for guests vs logged in
        let problemToUse;

        if (!user) {
            // Guests get one of the guest problems hardcoded (or via API if available)
            const { GUEST_PROBLEMS } = await import('@/lib/guest/guest-problems');
            const randomIndex = Math.floor(Math.random() * GUEST_PROBLEMS.length);
            problemToUse = GUEST_PROBLEMS[randomIndex];

            enableDemoMode();
            router.push(`/interview?problemId=${problemToUse.id}&demo=true`);
        } else {
            problemToUse = await getRandomProblem(
                filters.difficulty !== 'all' ? filters.difficulty : undefined
            );
            if (problemToUse) {
                handleStartInterview(problemToUse.id);
            }
        }
    };

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };


    // Pagination button styles - dark background
    const paginationBtnStyles = "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-800";

    return (
        <div className="min-h-screen pb-12 px-4" style={{ background: 'var(--surface-base)' }}>
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-white mb-2">
                            Practice Problems
                        </h1>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                                {totalCount} problems available
                            </span>
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                            <span className="text-xs font-bold text-emerald-400/80 uppercase tracking-widest">
                                {attemptedProblems.size} attempted
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={handleRandomProblem}
                        disabled={problems.length === 0}
                        className="btn-primary"
                    >
                        <Shuffle className="w-4 h-4 mr-2" />
                        Random Problem
                    </Button>
                </div>

                {/* Difficulty Mode Selector */}
                <DifficultyModeSelector selectedMode={difficultyMode} onChange={setDifficultyMode} />

                {!user ? (
                    <div className="text-center py-20 relative overflow-hidden rounded-2xl flex flex-col items-center justify-center mt-12" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                        <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
                            {[...Array(20)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-indigo-500/20 rounded-full flex shrink-0"
                                    style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%` }}
                                    animate={{ y: [0, -30, 0], opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                                    transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
                                />
                            ))}
                            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 50%)' }} />
                        </div>

                        <Brain className="w-16 h-16 text-indigo-400 mx-auto mb-4 relative z-10" />
                        <h2 className="text-white font-black text-2xl md:text-3xl mb-3 relative z-10">Access the full library</h2>
                        <p className="text-zinc-400 text-base mb-8 max-w-md relative z-10">
                            Create a free account to unlock 300+ LeetCode style problems, track your progress, and review past interviews.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                            <Button className="btn-primary" onClick={() => router.push('/login?tab=register')}>
                                Create Free Account
                            </Button>
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10" onClick={handleRandomProblem}>
                                <Shuffle className="w-4 h-4 mr-2" />
                                Try Random Problem
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="glass sticky top-[var(--navbar-h,64px)] z-20 py-3 px-4 -mx-4 sm:mx-0 sm:rounded-2xl mb-6">
                            <ProblemFilters onFilterChange={handleFilterChange} currentFilters={filters} />
                        </div>

                        {/* Loading State */}
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                    <p className="text-slate-400 text-sm">Loading problems...</p>
                                </div>
                            </div>
                        ) : displayedProblems.length === 0 ? (
                            <div className="text-center py-20 relative overflow-hidden rounded-2xl flex flex-col items-center justify-center" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                {/* Animated Background */}
                                <div className="absolute inset-0 opacity-30 pointer-events-none overflow-hidden">
                                    {[...Array(20)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute w-1 h-1 bg-indigo-500/20 rounded-full flex shrink-0"
                                            style={{
                                                left: `${Math.random() * 100}%`,
                                                top: `${Math.random() * 100}%`,
                                            }}
                                            animate={{
                                                y: [0, -30, 0],
                                                opacity: [0, 1, 0],
                                                scale: [0, 1.5, 0],
                                            }}
                                            transition={{
                                                duration: 3 + Math.random() * 2,
                                                repeat: Infinity,
                                                ease: "easeInOut",
                                                delay: Math.random() * 2,
                                            }}
                                        />
                                    ))}
                                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 50%)' }} />
                                </div>

                                <Brain className="w-16 h-16 text-zinc-600 mx-auto mb-4 relative z-10" />
                                <p className="text-zinc-200 font-bold text-lg mb-2 relative z-10">No problems found</p>
                                <p className="text-zinc-500 text-sm mb-6 relative z-10">
                                    Try changing your filters or add more problems to the database
                                </p>
                                <Button
                                    onClick={() => handleFilterChange({ difficulty: 'all', curatedList: '', attempted: 'all', searchQuery: '', topic: '' })}
                                    variant="outline"
                                    className="relative z-10"
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        ) : (
                            <>
                                {/* Problems List */}
                                <motion.div layout className="space-y-4" data-tour="problem-list">
                                    {displayedProblems.map((problem) => (
                                        <ProblemCard
                                            key={problem.id}
                                            problem={problem}
                                            attempted={attemptedProblems.has(problem.id)}
                                            onStart={(id) => handleStartInterview(id, problem)}
                                        />
                                    ))}
                                </motion.div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex justify-center mt-10">
                                        <div className="inline-flex items-center p-1 rounded-full shadow-lg overflow-x-auto max-w-full" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                                            <button
                                                onClick={() => goToPage(1)}
                                                disabled={currentPage === 1}
                                                className="h-8 px-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white whitespace-nowrap hidden sm:flex"
                                            >
                                                <ChevronsLeft className="w-4 h-4" /> First
                                            </button>

                                            <button
                                                onClick={() => goToPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="h-8 px-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white whitespace-nowrap"
                                            >
                                                <ChevronLeft className="w-4 h-4" /> Prev
                                            </button>

                                            <div className="w-px h-4 bg-zinc-800 mx-1" />

                                            <div className="flex px-1 gap-1">
                                                {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                                    let startPage = Math.max(1, currentPage - 2);
                                                    const endPage = Math.min(totalPages, startPage + 4);
                                                    if (endPage - startPage < 4) {
                                                        startPage = Math.max(1, endPage - 4);
                                                    }
                                                    const pageNum = startPage + i;
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => goToPage(pageNum)}
                                                            className={`w-8 h-8 flex items-center justify-center shrink-0 rounded-full text-xs font-bold transition-all ${currentPage === pageNum ? 'text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                                                            style={currentPage === pageNum ? { background: 'var(--accent-primary)' } : {}}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="w-px h-4 bg-zinc-800 mx-1" />

                                            <button
                                                onClick={() => goToPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="h-8 px-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white whitespace-nowrap"
                                            >
                                                Next <ChevronRight className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={() => goToPage(totalPages)}
                                                disabled={currentPage === totalPages}
                                                className="h-8 px-3 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1 transition-all disabled:opacity-50 hover:bg-zinc-800/50 text-zinc-400 hover:text-white whitespace-nowrap hidden sm:flex"
                                            >
                                                Last <ChevronsRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
