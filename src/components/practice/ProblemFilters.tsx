'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

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

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 space-y-5 border border-slate-700/50">
            {/* Difficulty Filters */}
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                    Difficulty Level
                </label>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => handleDifficultyChange('all')}
                        variant={difficulty === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className={difficulty === 'all'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        All Levels
                    </Button>
                    <Button
                        onClick={() => handleDifficultyChange('easy')}
                        variant={difficulty === 'easy' ? 'default' : 'outline'}
                        size="sm"
                        className={difficulty === 'easy'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        🟢 Easy
                    </Button>
                    <Button
                        onClick={() => handleDifficultyChange('medium')}
                        variant={difficulty === 'medium' ? 'default' : 'outline'}
                        size="sm"
                        className={difficulty === 'medium'
                            ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        🟡 Medium
                    </Button>
                    <Button
                        onClick={() => handleDifficultyChange('hard')}
                        variant={difficulty === 'hard' ? 'default' : 'outline'}
                        size="sm"
                        className={difficulty === 'hard'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        🔴 Hard
                    </Button>
                </div>
            </div>

            {/* Attempt Status Filters */}
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">
                    Attempt Status
                </label>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => handleAttemptedChange('all')}
                        variant={attempted === 'all' ? 'default' : 'outline'}
                        size="sm"
                        className={attempted === 'all'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        All Problems
                    </Button>
                    <Button
                        onClick={() => handleAttemptedChange('attempted')}
                        variant={attempted === 'attempted' ? 'default' : 'outline'}
                        size="sm"
                        className={attempted === 'attempted'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        ✓ Attempted
                    </Button>
                    <Button
                        onClick={() => handleAttemptedChange('not-attempted')}
                        variant={attempted === 'not-attempted' ? 'default' : 'outline'}
                        size="sm"
                        className={attempted === 'not-attempted'
                            ? 'bg-slate-600 hover:bg-slate-700 text-white'
                            : 'border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }
                    >
                        New Problems
                    </Button>
                </div>
            </div>
        </div>
    );
}
