'use client';

import { ChevronDown } from 'lucide-react';

// Curated list options
export const CURATED_LISTS = [
    { value: '', label: 'All Problems' },
    { value: 'blind-75', label: '🔥 Blind 75' },
    { value: 'grind-75', label: '💪 Grind 75' },
    { value: 'neetcode-150', label: '🎯 NeetCode 150' },
    { value: 'striver-a-z', label: '📚 Striver A-Z' },
];

interface ProblemFiltersProps {
    onFilterChange: (filters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        curatedList: string;
        attempted: 'all' | 'attempted' | 'not-attempted';
    }) => void;
    currentFilters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        curatedList: string;
        attempted: 'all' | 'attempted' | 'not-attempted';
    };
}

export function ProblemFilters({ onFilterChange, currentFilters }: ProblemFiltersProps) {
    const handleDifficultyChange = (newDifficulty: 'all' | 'easy' | 'medium' | 'hard') => {
        onFilterChange({ ...currentFilters, difficulty: newDifficulty });
    };

    const handleCuratedListChange = (newList: string) => {
        onFilterChange({ ...currentFilters, curatedList: newList });
    };

    const handleAttemptedChange = (newAttempted: 'all' | 'attempted' | 'not-attempted') => {
        onFilterChange({ ...currentFilters, attempted: newAttempted });
    };

    // Shared select styles - dark background with proper text color
    const selectStyles = "appearance-none bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors";

    return (
        <div className="flex flex-wrap gap-3 mb-6">
            {/* Curated List Dropdown */}
            <div className="relative">
                <select
                    value={currentFilters.curatedList}
                    onChange={(e) => handleCuratedListChange(e.target.value)}
                    className={selectStyles}
                >
                    {CURATED_LISTS.map((list) => (
                        <option key={list.value} value={list.value} className="bg-slate-800 text-white">
                            {list.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Difficulty Dropdown */}
            <div className="relative">
                <select
                    value={currentFilters.difficulty}
                    onChange={(e) => handleDifficultyChange(e.target.value as 'all' | 'easy' | 'medium' | 'hard')}
                    className={selectStyles}
                >
                    <option value="all" className="bg-slate-800 text-white">All Levels</option>
                    <option value="easy" className="bg-slate-800 text-white">🟢 Easy</option>
                    <option value="medium" className="bg-slate-800 text-white">🟡 Medium</option>
                    <option value="hard" className="bg-slate-800 text-white">🔴 Hard</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Attempted Status Dropdown */}
            <div className="relative">
                <select
                    value={currentFilters.attempted}
                    onChange={(e) => handleAttemptedChange(e.target.value as 'all' | 'attempted' | 'not-attempted')}
                    className={selectStyles}
                >
                    <option value="all" className="bg-slate-800 text-white">All Status</option>
                    <option value="attempted" className="bg-slate-800 text-white">✓ Attempted</option>
                    <option value="not-attempted" className="bg-slate-800 text-white">New Problems</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
}
