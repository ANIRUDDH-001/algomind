/**
 * @codesage
 * @file      src/components/practice/ProblemFilters.tsx
 * @purpose   Search and filter controls for the problem practice list.
 * @tech      React, TailwindCSS
 * @connects  lucide-react
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
'use client';

import { useState } from 'react';
import { ChevronDown, Search, Filter } from 'lucide-react';

// Curated list options
export const CURATED_LISTS = [
    { value: '', label: 'All Problems' },
    { value: 'blind-75', label: '🔥 Blind 75' },
    { value: 'grind-75', label: '💪 Grind 75' },
    { value: 'neetcode-150', label: '🎯 NeetCode 150' },
    { value: 'striver-a-z', label: '📚 Striver A-Z' },
];

export const TOPICS = [
    { value: '', label: 'All Topics' },
    { value: 'array', label: 'Array' },
    { value: 'string', label: 'String' },
    { value: 'hash-table', label: 'Hash Table' },
    { value: 'dynamic-programming', label: 'Dynamic Programming' },
    { value: 'math', label: 'Math' },
    { value: 'sorting', label: 'Sorting' },
    { value: 'greedy', label: 'Greedy' },
    { value: 'depth-first-search', label: 'Depth-First Search' },
    { value: 'binary-search', label: 'Binary Search' },
    { value: 'matrix', label: 'Matrix' },
    { value: 'tree', label: 'Tree' },
    { value: 'heap', label: 'Heap' },
    { value: 'graph', label: 'Graph' },
    { value: 'two-pointers', label: 'Two Pointers' },
    { value: 'binary-tree', label: 'Binary Tree' },
    { value: 'backtracking', label: 'Backtracking' },
    { value: 'stack', label: 'Stack' },
    { value: 'linked-list', label: 'Linked List' },
    { value: 'sliding-window', label: 'Sliding Window' },
];

interface ProblemFiltersProps {
    onFilterChange: (filters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        curatedList: string;
        attempted: 'all' | 'attempted' | 'not-attempted';
        searchQuery: string;
        topic: string;
    }) => void;
    currentFilters: {
        difficulty: 'all' | 'easy' | 'medium' | 'hard';
        curatedList: string;
        attempted: 'all' | 'attempted' | 'not-attempted';
        searchQuery: string;
        topic: string;
    };
}

export function ProblemFilters({ onFilterChange, currentFilters }: ProblemFiltersProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    const handleDifficultyChange = (newDifficulty: 'all' | 'easy' | 'medium' | 'hard') => {
        onFilterChange({ ...currentFilters, difficulty: newDifficulty });
    };

    const handleCuratedListChange = (newList: string) => {
        onFilterChange({ ...currentFilters, curatedList: newList });
    };

    const handleAttemptedChange = (newAttempted: 'all' | 'attempted' | 'not-attempted') => {
        onFilterChange({ ...currentFilters, attempted: newAttempted });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFilterChange({ ...currentFilters, searchQuery: e.target.value });
    };

    const handleTopicChange = (newTopic: string) => {
        onFilterChange({ ...currentFilters, topic: newTopic });
    };

    // Shared select styles - tokenized surface with indigo focus ring
    const selectStyles = "appearance-none text-white text-sm font-medium rounded-lg px-4 py-2.5 pr-10 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors";

    return (
        <div className="flex flex-col gap-4 mb-2">
            {/* Mobile Toggle Button */}
            <div className="md:hidden">
                <button 
                    onClick={() => setIsMobileOpen(!isMobileOpen)} 
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors"
                    style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)', color: 'white' }}
                >
                    <span className="flex items-center gap-2 font-medium text-sm">
                        <Filter className="w-4 h-4 text-indigo-400" />
                        {isMobileOpen ? 'Hide Filters' : 'Show Filters'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isMobileOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Filter Contents */}
            <div className={`flex-col gap-4 ${isMobileOpen ? 'flex' : 'hidden'} md:flex`}>
                {/* Search Bar */}
                <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                    type="text"
                    placeholder="Search problems (e.g., 'Two Sum')"
                    value={currentFilters.searchQuery}
                    onChange={handleSearchChange}
                    className="w-full text-sm font-medium rounded-lg pl-10 pr-4 py-2.5 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                    style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--surface-edge)',
                        color: 'white'
                    }}
                />
            </div>

            <div className="flex flex-wrap gap-3">
                {/* Topic Dropdown */}
                <div className="relative">
                    <select
                        value={currentFilters.topic}
                        onChange={(e) => handleTopicChange(e.target.value)}
                        className={selectStyles}
                        style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            outline: 'none'
                        }}
                    >
                        {TOPICS.map((topic) => (
                            <option key={topic.value} value={topic.value} style={{ background: 'var(--surface-2)', color: 'white' }}>
                                {topic.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>

                {/* Curated List Dropdown */}
                <div className="relative">
                    <select
                        value={currentFilters.curatedList}
                        onChange={(e) => handleCuratedListChange(e.target.value)}
                        className={selectStyles}
                        style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            outline: 'none'
                        }}
                    >
                        {CURATED_LISTS.map((list) => (
                            <option key={list.value} value={list.value} style={{ background: 'var(--surface-2)', color: 'white' }}>
                                {list.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>

                {/* Difficulty Dropdown */}
                <div className="relative">
                    <select
                        value={currentFilters.difficulty}
                        onChange={(e) => handleDifficultyChange(e.target.value as 'all' | 'easy' | 'medium' | 'hard')}
                        className={selectStyles}
                        style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            outline: 'none'
                        }}
                    >
                        <option value="all" style={{ background: 'var(--surface-2)', color: 'white' }}>All Levels</option>
                        <option value="easy" style={{ background: 'var(--surface-2)', color: 'white' }}>🟢 Easy</option>
                        <option value="medium" style={{ background: 'var(--surface-2)', color: 'white' }}>🟡 Medium</option>
                        <option value="hard" style={{ background: 'var(--surface-2)', color: 'white' }}>🔴 Hard</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>

                {/* Attempted Status Dropdown */}
                <div className="relative">
                    <select
                        value={currentFilters.attempted}
                        onChange={(e) => handleAttemptedChange(e.target.value as 'all' | 'attempted' | 'not-attempted')}
                        className={selectStyles}
                        style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--surface-edge)',
                            outline: 'none'
                        }}
                    >
                        <option value="all" style={{ background: 'var(--surface-2)', color: 'white' }}>All Status</option>
                        <option value="attempted" style={{ background: 'var(--surface-2)', color: 'white' }}>✓ Attempted</option>
                        <option value="not-attempted" style={{ background: 'var(--surface-2)', color: 'white' }}>New Problems</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                </div>
            </div>
            </div>
        </div>
    );
}
