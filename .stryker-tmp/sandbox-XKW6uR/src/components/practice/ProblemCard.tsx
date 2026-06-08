/**
 * @codesage
 * @file      src/components/practice/ProblemCard.tsx
 * @purpose   Compact, information-dense card displaying a practice problem.
 * @tech      React, Framer Motion, TailwindCSS
 * @connects  framer-motion, lucide-react, @/lib/supabase/problems
 * @apis      None
 * @db        None
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Play } from 'lucide-react';
import type { Problem } from '@/lib/supabase/problems';

interface ProblemCardProps {
    problem: Problem;
    attempted: boolean;
    onStart: (problemId: string) => void;
}

// New card design: tight, information-dense, editorial
export function ProblemCard({ problem, attempted, onStart }: ProblemCardProps) {
    const [expanded, setExpanded] = useState(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const diffClass: any = { easy: 'badge-easy', medium: 'badge-medium', hard: 'badge-hard' }[problem.difficulty] || 'badge-medium';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="group rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
            style={{
                background: 'var(--surface-1)',
                border: '1px solid var(--surface-edge)',
                boxShadow: 'var(--shadow-card)',
            }}
            whileHover={{ borderColor: 'rgba(99,102,241,0.3)', y: -2 }}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="p-5">
                {/* Top row */}
                <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={diffClass}>{problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}</span>
                            {attempted && (
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Done
                                </span>
                            )}
                        </div>
                        <h3 className="font-bold text-zinc-100 group-hover:text-white transition-colors text-base">
                            {problem.title}
                        </h3>
                    </div>

                    {/* Desktop: hover-reveal button */}
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); onStart(problem.id); }}
                        whileTap={{ scale: 0.95 }}
                        className="btn-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
                    >
                        Practice
                    </motion.button>

                    {/* Mobile: always-visible compact start button */}
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); onStart(problem.id); }}
                        whileTap={{ scale: 0.95 }}
                        className="sm:hidden shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-indigo-400 transition-colors"
                        style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                        aria-label={`Start practice: ${problem.title}`}
                    >
                        <Play className="w-4 h-4" />
                    </motion.button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                    {problem.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[11px] px-2 py-0.5 rounded-md font-medium text-zinc-500"
                            style={{ background: 'var(--surface-3)', border: '1px solid var(--surface-edge)' }}>
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* Expanded: short description + mobile start button */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-0 space-y-4"
                            style={{ borderTop: '1px solid var(--surface-edge)' }}>
                            <p className="text-sm text-zinc-400 line-clamp-3 mt-3">
                                {problem.description.split('\n\n')[0]}
                            </p>
                            <button onClick={(e) => { e.stopPropagation(); onStart(problem.id); }}
                                className="btn-primary w-full sm:hidden">
                                Start Practice
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
