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
        const { data, error } = await supabase
            .from('problems')
            .select('*')
            .eq('id', id)
            .single();

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
