'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ProblemFiltersProps {
    onFilterChange: (filters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        attempted: 'all' | 'attempted' | 'not-attempted';
    }) => void;
}

export function ProblemFilters({ onFilterChange }: ProblemFiltersProps) {
    const [difficulty, setDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [attempted, setAttempted] = useState<'all' | 'attempted' | 'not-attempted'>('all');

    const handleDifficultyChange = (newDifficulty: typeof difficulty) => {
        setDifficulty(newDifficulty);
        onFilterChange({ difficulty: newDifficulty, attempted });
    };

    const handleAttemptedChange = (newAttempted: typeof attempted) => {
        setAttempted(newAttempted);
        onFilterChange({ difficulty, attempted: newAttempted });
    };

    const difficultyLabels = {
        all: 'All Levels',
        easy: '🟢 Easy',
        medium: '🟡 Medium',
        hard: '🔴 Hard',
    };

    const attemptedLabels = {
        all: 'All Problems',
        attempted: '✓ Attempted',
        'not-attempted': 'New Problems',
    };

    return (
        <div className="flex flex-wrap gap-3 mb-6">
            {/* Difficulty Dropdown */}
            <div className="relative">
                <select
                    value={difficulty}
                    onChange={(e) => handleDifficultyChange(e.target.value as typeof difficulty)}
                    className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                >
                    <option value="all">All Levels</option>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Attempted Status Dropdown */}
            <div className="relative">
                <select
                    value={attempted}
                    onChange={(e) => handleAttemptedChange(e.target.value as typeof attempted)}
                    className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                >
                    <option value="all">All Problems</option>
                    <option value="attempted">✓ Attempted</option>
                    <option value="not-attempted">New Problems</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
}
