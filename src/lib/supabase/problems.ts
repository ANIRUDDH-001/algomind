import { getSupabase } from './client';

export interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    hints: string[];
    examples: {
        input: string;
        output: string;
        explanation?: string;
    }[];
}

export async function getRandomProblem(
    difficulty?: 'easy' | 'medium' | 'hard'
): Promise<Problem | null> {
    const supabase = getSupabase();

    if (!supabase) {
        console.warn('Supabase not configured, using fallback problems');
        return getFallbackProblem(difficulty);
    }

    try {
        const { data, error } = await supabase.rpc('get_random_problem', {
            problem_difficulty: difficulty || null,
        });

        if (error) {
            console.error('Error fetching problem:', error);
            return getFallbackProblem(difficulty);
        }

        return data?.[0] || getFallbackProblem(difficulty);
    } catch (error) {
        console.error('Failed to get random problem:', error);
        return getFallbackProblem(difficulty);
    }
}

export async function getAllProblems(): Promise<Problem[]> {
    const supabase = getSupabase();

    if (!supabase) {
        console.warn('Supabase not configured, using fallback problems');
        return fallbackProblems;
    }

    try {
        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .order('difficulty', { ascending: true })
            .order('title', { ascending: true });

        if (error) {
            console.error('Error fetching problems:', error);
            return fallbackProblems;
        }

        return data || fallbackProblems;
    } catch (error) {
        console.error('Failed to get problems:', error);
        return fallbackProblems;
    }
}

export async function getProblemById(id: string): Promise<Problem | null> {
    const supabase = getSupabase();

    if (!supabase) {
        return fallbackProblems.find(p => p.id === id) || null;
    }

    try {
        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching problem:', error);
            return fallbackProblems.find(p => p.id === id) || null;
        }

        return data;
    } catch (error) {
        console.error('Failed to get problem:', error);
        return fallbackProblems.find(p => p.id === id) || null;
    }
}

// Fallback problems when Supabase is not configured
const fallbackProblems: Problem[] = [
    {
        id: 'two-sum',
        title: 'Two Sum',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.',
        difficulty: 'easy',
        tags: ['array', 'hash-table'],
        hints: ['Use a hash map to store numbers you\'ve seen', 'For each number, check if target - number exists in the map'],
        examples: [
            { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
            { input: 'nums = [3,2,4], target = 6', output: '[1,2]' }
        ]
    },
    {
        id: 'valid-parentheses',
        title: 'Valid Parentheses',
        description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.',
        difficulty: 'easy',
        tags: ['string', 'stack'],
        hints: ['Use a stack to track opening brackets', 'When you see a closing bracket, check if it matches the last opening bracket'],
        examples: [
            { input: 's = "()"', output: 'true' },
            { input: 's = "()[]{}"', output: 'true' },
            { input: 's = "(]"', output: 'false' }
        ]
    },
    {
        id: 'merge-intervals',
        title: 'Merge Intervals',
        description: 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
        difficulty: 'medium',
        tags: ['array', 'sorting'],
        hints: ['Sort intervals by start time', 'Iterate through sorted intervals and merge if they overlap'],
        examples: [
            { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' }
        ]
    },
    {
        id: 'longest-substring',
        title: 'Longest Substring Without Repeating Characters',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        difficulty: 'medium',
        tags: ['string', 'sliding-window', 'hash-table'],
        hints: ['Use sliding window technique', 'Keep track of characters seen with a hash map', 'Move window when duplicate found'],
        examples: [
            { input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' },
            { input: 's = "bbbbb"', output: '1' }
        ]
    },
    {
        id: 'binary-tree-traversal',
        title: 'Binary Tree Inorder Traversal',
        description: 'Given the root of a binary tree, return the inorder traversal of its nodes\' values.',
        difficulty: 'easy',
        tags: ['tree', 'depth-first-search', 'recursion'],
        hints: ['Use recursive approach: left -> root -> right', 'Alternatively use iterative approach with a stack'],
        examples: [
            { input: 'root = [1,null,2,3]', output: '[1,3,2]' }
        ]
    }
];

function getFallbackProblem(difficulty?: 'easy' | 'medium' | 'hard'): Problem {
    const filtered = difficulty
        ? fallbackProblems.filter(p => p.difficulty === difficulty)
        : fallbackProblems;
    return filtered[Math.floor(Math.random() * filtered.length)];
}
