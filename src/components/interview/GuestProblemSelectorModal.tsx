/**
 * @codesage
 * @file      src/components/interview/GuestProblemSelectorModal.tsx
 * @purpose   Allows guest users to select or randomly choose a practice problem.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/lib/guest/guest-problems
 * @apis      None
 * @db        None
 * @state     useState
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
'use client';

import React, { useState } from 'react';
import { GUEST_PROBLEMS } from '@/lib/guest/guest-problems';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shuffle, ChevronRight, Clock, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

type GuestProblem = typeof GUEST_PROBLEMS[number];

interface GuestProblemSelectorModalProps {
    isOpen: boolean;
    onSelect: (problem: GuestProblem) => void;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; classes: string }> = {
    easy: { label: 'Easy', classes: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' },
    medium: { label: 'Medium', classes: 'border-amber-500/40 bg-amber-500/10 text-amber-400' },
    hard: { label: 'Hard', classes: 'border-red-500/40 bg-red-500/10 text-red-400' },
};

export function GuestProblemSelectorModal({ isOpen, onSelect }: GuestProblemSelectorModalProps) {
    const [hovered, setHovered] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleRandom = () => {
        const idx = Math.floor(Math.random() * GUEST_PROBLEMS.length);
        onSelect(GUEST_PROBLEMS[idx]);
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={() => {}} // Usually guest problem selector is not closeable unless chosen or we provide a way. Wait, does it have an onClose? No.
            desktopClassName="max-w-xl p-0 border-white/10"
            className="p-0 border-white/10"
        >
            <div
                className="w-full space-y-5"
                data-testid="guest-selector-modal"
                style={{ background: 'rgba(2, 6, 23, 0.97)' }} // Added back background if needed, though standard modal background is applied. Let's just use className.
            >
                <div className="p-6 pb-2">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/25 bg-indigo-500/8 text-indigo-400 text-[11px] font-bold uppercase tracking-[0.15em]">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            Guest Mode
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">
                            Choose Your Problem
                        </h1>
                        <div className="flex items-center justify-center gap-5 text-xs text-zinc-500">
                            <span className="flex items-center gap-1.5">
                                <MessageSquare className="w-3 h-3" />
                                10 rounds with Kai
                            </span>
                            <span className="w-px h-3 bg-zinc-700" />
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                10 minute session
                            </span>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    {/* Problem list */}
                    <div className="space-y-1.5">
                        {GUEST_PROBLEMS.map((problem) => {
                            const diff = DIFFICULTY_CONFIG[problem.difficulty] ?? DIFFICULTY_CONFIG.medium;
                            const isHov = hovered === problem.id;

                            return (
                                <button
                                    key={problem.id}
                                    data-testid={`problem-card-${problem.id}`}
                                    onClick={() => onSelect(problem)}
                                    onMouseEnter={() => setHovered(problem.id)}
                                    onMouseLeave={() => setHovered(null)}
                                    className={cn(
                                        'w-full text-left p-4 rounded-2xl border transition-all duration-150 flex items-center justify-between',
                                        isHov
                                            ? 'bg-white/[0.04] border-white/15 scale-[1.01] shadow-lg'
                                            : 'bg-white/[0.015] border-white/[0.06]'
                                    )}
                                >
                                    <div className="space-y-1.5 min-w-0">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-white font-bold text-sm leading-tight">
                                                {problem.title}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className={cn('text-[10px] font-bold h-4 px-1.5 shrink-0', diff.classes)}
                                            >
                                                {diff.label}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(problem.tags ?? []).slice(0, 3).map(tag => (
                                                <span
                                                    key={tag}
                                                    className="text-[10px] text-zinc-500 bg-zinc-800/70 border border-zinc-700/50 rounded-full px-2 py-0.5"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <ChevronRight
                                        className={cn(
                                            'w-4 h-4 shrink-0 ml-3 transition-all duration-150',
                                            isHov ? 'text-white translate-x-0.5' : 'text-zinc-600'
                                        )}
                                    />
                                </button>
                            );
                        })}
                    </div>

                    {/* Surprise me */}
                    <Button
                        data-testid="random-problem-button"
                        onClick={handleRandom}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl gap-2 text-sm"
                    >
                        <Shuffle className="w-4 h-4" />
                        Surprise Me — Pick Random
                    </Button>

                    <p className="text-center text-[11px] text-zinc-600">
                        Results are not saved in guest mode.{' '}
                        <a href="/login" className="text-zinc-400 hover:text-white underline underline-offset-2 transition-colors">
                            Sign up free
                        </a>{' '}
                        to save your progress.
                    </p>
                </div>
            </div>
        </ResponsiveModal>
    );
}
