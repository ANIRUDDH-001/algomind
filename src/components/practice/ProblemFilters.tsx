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
    }) => void;
    currentFilters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        curatedList: string;
    };
}

export function ProblemFilters({ onFilterChange, currentFilters }: ProblemFiltersProps) {
    const handleDifficultyChange = (newDifficulty: 'all' | 'easy' | 'medium' | 'hard') => {
        onFilterChange({ ...currentFilters, difficulty: newDifficulty });
    };

    const handleCuratedListChange = (newList: string) => {
        onFilterChange({ ...currentFilters, curatedList: newList });
    };

    return (
        <div className="flex flex-wrap gap-3 mb-6">
            {/* Curated List Dropdown */}
            <div className="relative">
                <select
                    value={currentFilters.curatedList}
                    onChange={(e) => handleCuratedListChange(e.target.value)}
                    className="appearance-none bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-500/30 text-white text-sm font-bold rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                >
                    {CURATED_LISTS.map((list) => (
                        <option key={list.value} value={list.value}>
                            {list.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
            </div>

            {/* Difficulty Dropdown */}
            <div className="relative">
                <select
                    value={currentFilters.difficulty}
                    onChange={(e) => handleDifficultyChange(e.target.value as 'all' | 'easy' | 'medium' | 'hard')}
                    className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-colors"
                >
                    <option value="all">All Levels</option>
                    <option value="easy">🟢 Easy</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="hard">🔴 Hard</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
}
