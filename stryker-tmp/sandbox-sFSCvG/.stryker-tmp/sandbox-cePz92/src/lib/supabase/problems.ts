/**
 * @codesage
 * @file      src/lib/supabase/problems.ts
 * @purpose   Handles database operations for fetching and normalizing problem records.
 * @tech      Supabase JS Client
 * @connects  Imports from ./client, exported for use in problem-related features.
 * @apis      None
 * @db        problems (table), get_random_problem (RPC)
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { getSupabase, isSupabaseConfigured } from './client';

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
    external_url?: string;
    curated_lists?: string[];
    time_complexity?: string;
    space_complexity?: string;
}

export function normalizeProblem(data: any): Problem {
    if (!data) return data;
    let examples = data.examples ?? [];
    if (typeof data.examples === 'string') {
        try {
            examples = JSON.parse(data.examples);
        } catch (e) {
            examples = [];
        }
    }
    return { ...data, examples };
}

export async function getRandomProblem(
    difficulty?: 'easy' | 'medium' | 'hard'
): Promise<Problem | null> {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        console.error('Supabase not configured - cannot fetch problems');
        return null;
    }

    try {
        // The RPC function returns limited columns (missing external_url)
        // So we get the random problem ID first, then fetch the full problem
        const { data, error } = await supabase.rpc('get_random_problem', {
            problem_difficulty: difficulty || null,
        });

        if (error) {
            console.error('Error fetching random problem ID:', error);
            return null;
        }

        const randomProblem = data?.[0];
        if (!randomProblem?.id) {
            console.error('No random problem returned from RPC');
            return null;
        }



        // Now fetch the full problem with all columns including external_url
        const fullProblem = await getProblemById(randomProblem.id);

        return fullProblem ? normalizeProblem(fullProblem) : null;
    } catch (error) {
        console.error('Failed to get random problem:', error);
        return null;
    }
}


export async function getAllProblems(): Promise<Problem[]> {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        console.error('Supabase not configured - cannot fetch problems');
        return [];
    }

    try {
        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .order('difficulty', { ascending: true })
            .order('title', { ascending: true });

        if (error) {
            console.error('Error fetching problems:', error);
            return [];
        }

        return (data || []).map(normalizeProblem);
    } catch (error) {
        console.error('Failed to get problems:', error);
        return [];
    }
}

export async function getProblemById(id: string): Promise<Problem | null> {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        console.error('Supabase not configured - cannot fetch problem');
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching problem:', error);
            return null;
        }

        return normalizeProblem(data);
    } catch (error) {
        console.error('Failed to get problem:', error);
        return null;
    }
}

export interface PaginatedProblemsResult {
    problems: Problem[];
    totalCount: number;
    totalPages: number;
}

export async function getProblemsPaginated(
    page: number = 1,
    limit: number = 15,
    filters?: {
        difficulty?: 'easy' | 'medium' | 'hard';
        curatedList?: string;
        searchQuery?: string;
        topic?: string;
    }
): Promise<PaginatedProblemsResult> {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        console.error('Supabase not configured - cannot fetch problems');
        return { problems: [], totalCount: 0, totalPages: 0 };
    }

    try {
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabase
            .from('problems')
            .select('*', { count: 'exact' });

        // Apply difficulty filter
        if (filters?.difficulty) {
            query = query.eq('difficulty', filters.difficulty);
        }

        // Apply search query
        if (filters?.searchQuery) {
            query = query.ilike('title', `%${filters.searchQuery}%`);
        }

        // Apply topic filter
        if (filters?.topic) {
            query = query.contains('tags', [filters.topic]);
        }

        // Apply curated list filter
        if (filters?.curatedList) {
            query = query.contains('curated_lists', [filters.curatedList]);
        }

        // Add ordering and pagination
        const { data, error, count } = await query
            .order('difficulty', { ascending: true })
            .order('title', { ascending: true })
            .range(from, to);

        if (error) {
            console.error('Error fetching paginated problems:', error);
            return { problems: [], totalCount: 0, totalPages: 0 };
        }

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        return {
            problems: (data || []).map(normalizeProblem),
            totalCount,
            totalPages,
        };
    } catch (error) {
        console.error('Failed to get paginated problems:', error);
        return { problems: [], totalCount: 0, totalPages: 0 };
    }
}

