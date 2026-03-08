/**
 * Problem types for AlgoMind
 */

export interface Problem {
    id: string;
    title: string;
    content: string;
    description?: string;
    examples?: any;
    constraints?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category?: string;
    patterns?: string[];
    hints?: string[];
    solution?: string;
    external_url?: string;
    ragContext?: string; // Pre-embedded context for guest problems
    tags?: string[];
    curated_lists?: string[];
    time_complexity?: string;
    space_complexity?: string;
}

export interface ProblemWithContext extends Problem {
    ragContext: string;
}

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ProblemFilter {
    difficulty?: Difficulty;
    category?: string;
    pattern?: string;
}
