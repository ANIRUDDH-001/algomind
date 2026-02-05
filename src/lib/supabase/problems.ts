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

export async function getRandomProblem(
    difficulty?: 'easy' | 'medium' | 'hard'
): Promise<Problem | null> {
    const supabase = getSupabase();

    if (!supabase || !isSupabaseConfigured()) {
        console.error('Supabase not configured - cannot fetch problems');
        return null;
    }

    try {
        const { data, error } = await supabase.rpc('get_random_problem', {
            problem_difficulty: difficulty || null,
        });

        if (error) {
            console.error('Error fetching problem:', error);
            return null;
        }

        return data?.[0] || null;
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

        return data || [];
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
        console.log('[DEBUG] getProblemById called with id:', id);

        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .eq('id', id)
            .single();

        console.log('[DEBUG] getProblemById raw response:', { data, error });
        console.log('[DEBUG] getProblemById external_url value:', data?.external_url);

        if (error) {
            console.error('Error fetching problem:', error);
            return null;
        }

        return data;
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
            problems: data || [],
            totalCount,
            totalPages,
        };
    } catch (error) {
        console.error('Failed to get paginated problems:', error);
        return { problems: [], totalCount: 0, totalPages: 0 };
    }
}

