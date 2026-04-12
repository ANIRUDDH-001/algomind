 
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProblemsPaginated, getRandomProblem, type Problem } from '@/lib/supabase/problems';
import { ProblemFilters } from '@/components/practice/ProblemFilters';
import { ProblemCard } from '@/components/practice/ProblemCard';
import { DifficultyModeSelector, type DifficultyMode } from '@/components/practice/DifficultyModeSelector';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Shuffle, Brain, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

const PROBLEMS_PER_PAGE = 10;

// Pre-computed particle data to avoid calling Math.random() during render.
const GUEST_PARTICLES = Array.from({ length: 20 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 3 + Math.random() * 2,
    delay: Math.random() * 2,
}));
const EMPTY_PARTICLES = Array.from({ length: 20 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    duration: 3 + Math.random() * 2,
    delay: Math.random() * 2,
}));

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


    // Sprint P2 picker state
    const [sprintP1, setSprintP1] = useState<Problem | null>(null);

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
        const timer = window.setTimeout(() => {
            void loadProblems();
        }, 0);

        return () => window.clearTimeout(timer);
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
        const timer = window.setTimeout(() => {
            void loadAttemptedProblems();
        }, 0);

        return () => window.clearTimeout(timer);
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
        // Sprint mode: show P2 picker instead of navigating directly
        if (difficultyMode === 'sprint' && problem) {
            setSprintP1(problem);
            return;
        }

        // Optimistically mark as attempted in local state
        const newAttempted = new Set(attemptedProblems);
        newAttempted.add(problemId);
        setAttemptedProblems(newAttempted);

        // Store full problem in sessionStorage for Interview page to use
        if (problem) {
            sessionStorage.setItem('currentProblem', JSON.stringify(problem));
        }

        if (!user) {
            router.push('/login');
            return;
        }
        router.push(`/interview?problemId=${problemId}&mode=${difficultyMode}`);
    };

    const handleSprintP2Select = (p2: Problem) => {
        if (!sprintP1) return;
        const newAttempted = new Set(attemptedProblems);
        newAttempted.add(sprintP1.id);
        setAttemptedProblems(newAttempted);
        sessionStorage.setItem('currentProblem', JSON.stringify(sprintP1));
        setSprintP1(null);
        router.push(`/interview?problemId=${sprintP1.id}&p2Id=${p2.id}&mode=sprint`);
    };

    const handleRandomProblem = async () => {
        if (!user) {
            router.push('/login');
            return;
        }
        const problemToUse = await getRandomProblem(
            filters.difficulty !== 'all' ? filters.difficulty : undefined
        );
        if (problemToUse) {
            handleStartInterview(problemToUse.id);
        }
    };

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

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
                        disabled={!user && problems.length === 0 && false}
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
                            {GUEST_PARTICLES.map((p, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute w-1 h-1 bg-indigo-500/20 rounded-full flex shrink-0"
                                    style={{ left: `${p.left}%`, top: `${p.top}%` }}
                                    animate={{ y: [0, -30, 0], opacity: [0, 1, 0], scale: [0, 1.5, 0] }}
                                    transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
                                />
                            ))}
                            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15) 0%, transparent 50%)' }} />
                        </div>

                        <Brain className="w-16 h-16 text-indigo-400 mx-auto mb-4 relative z-10" />
                        <h2 className="text-white font-black text-2xl md:text-3xl mb-3 relative z-10">Access the full library</h2>
                        <p className="text-zinc-400 text-base mb-8 max-w-md relative z-10">
                            Create a free account to unlock 300+ curated DSA problems, track your progress, and review past interviews.
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
                        <div className="glass sticky top-[var(--navbar-h,64px)] z-30 py-3 px-4 -mx-4 sm:mx-0 sm:rounded-2xl mb-6">
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
                                    {EMPTY_PARTICLES.map((p, i) => (
                                        <motion.div
                                            key={i}
                                            className="absolute w-1 h-1 bg-indigo-500/20 rounded-full flex shrink-0"
                                            style={{
                                                left: `${p.left}%`,
                                                top: `${p.top}%`,
                                            }}
                                            animate={{
                                                y: [0, -30, 0],
                                                opacity: [0, 1, 0],
                                                scale: [0, 1.5, 0],
                                            }}
                                            transition={{
                                                duration: p.duration,
                                                repeat: Infinity,
                                                ease: "easeInOut",
                                                delay: p.delay,
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

            {/* Sprint P2 Picker Modal */}
            {sprintP1 && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-1">Pick Problem 2 for Sprint</h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            Problem 1: <span className="text-indigo-400 font-semibold">{sprintP1.title}</span>
                        </p>
                        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                            {problems.filter(p => p.id !== sprintP1.id).length === 0 ? (
                                <p className="text-zinc-500 text-sm text-center py-8">No other problems available. Try a different filter.</p>
                            ) : (
                                problems.filter(p => p.id !== sprintP1.id).map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSprintP2Select(p)}
                                        className="w-full text-left p-3 rounded-xl border border-zinc-700/50 hover:border-indigo-500/50 hover:bg-zinc-800/50 transition-colors group"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-white font-medium text-sm group-hover:text-indigo-300 transition-colors">{p.title}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.difficulty === 'easy' ? 'bg-emerald-500/20 text-emerald-400' : p.difficulty === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {p.difficulty}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        <button
                            onClick={() => setSprintP1(null)}
                            className="mt-4 w-full text-sm text-zinc-400 hover:text-white transition-colors py-2"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
