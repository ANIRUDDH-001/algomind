import { UserProgress, CognitiveSkill } from '@/types/assessment';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Problem } from '@/lib/supabase/problems';

export interface Recommendation {
    skillId: CognitiveSkill;
    title: string;
    description: string;
    suggestedProblems: Array<{
        id: string;
        title: string;
        difficulty: string;
        external_url?: string;
    }>;
    priority: 'high' | 'medium' | 'low';
}

// Map cognitive skills to problem tags for better targeting
const SKILL_TO_TAGS: Record<string, string[]> = {
    'problem-decomposition': ['Recursion', 'Dynamic Programming', 'Graph', 'Trees', 'Backtracking'],
    'pattern-recognition': ['String', 'Array', 'Sliding Window', 'Two Pointers', 'Hashing'],
    'algorithmic-thinking': ['Sorting', 'Searching', 'Greedy', 'Math', 'Bit Manipulation'],
    'complexity-analysis': ['Recursion', 'Sorting', 'DP', 'Graph'],
    'edge-case-handling': ['String', 'Math', 'Array', 'Bit Manipulation'],
    'optimization-mindset': ['Dynamic Programming', 'Greedy', 'Graph', 'Heap', 'Segment Tree'],
    'debugging-approach': ['String', 'Array', 'LinkedList', 'Graph'],
    'communication-clarity': ['String', 'Array', 'Recursion']
};

export class RecommendationEngine {
    async analyze(progress: UserProgress): Promise<Recommendation[]> {
        if (!progress || progress.totalSessions === 0) return [];
        if (!isSupabaseConfigured()) return [];

        const supabase = getSupabase();
        if (!supabase) return [];

        const results: Recommendation[] = [];

        // 1. Identify weakest skills
        const sortedSkills = Object.entries(progress.averageScores)
            .sort(([, a], [, b]) => a - b);

        const weakestSkills = sortedSkills.slice(0, 2);

        for (const [skillId, score] of weakestSkills) {
            const id = skillId as CognitiveSkill;
            const tags = SKILL_TO_TAGS[id] || [];

            // Determine difficulty based on score
            // 0-4: easy, 4-7: medium, 7-10: hard
            let targetDifficulty = 'easy';
            if (score >= 4 && score < 7) targetDifficulty = 'medium';
            if (score >= 7) targetDifficulty = 'hard';

            // Fetch problems from Supabase matching tags OR difficulty
            // We'll try to find problems that have at least one matching tag and correct difficulty
            const { data: dbProblems, error } = await supabase
                .from('problems')
                .select('id, title, difficulty, external_url, tags')
                .eq('difficulty', targetDifficulty)
                .contains('tags', [tags[0]]) // Start with most relevant tag
                .limit(2);

            let suggestions = dbProblems || [];

            // Fallback: If no tag match, just get by difficulty
            if (suggestions.length === 0) {
                const { data: fallbackProblems } = await supabase
                    .from('problems')
                    .select('id, title, difficulty, external_url')
                    .eq('difficulty', targetDifficulty)
                    .limit(2);
                suggestions = fallbackProblems || [];
            }

            results.push({
                skillId: id,
                title: `Boost your ${id.replace(/-/g, ' ')}`,
                description: `Your average score of ${score.toFixed(1)} suggests room for growth here. Practice these ${targetDifficulty} problems to improve.`,
                suggestedProblems: suggestions.map((p: { id: string; title: string; difficulty: string; external_url?: string }) => ({
                    id: p.id,
                    title: p.title,
                    difficulty: p.difficulty,
                    external_url: p.external_url
                })),
                priority: score < 5 ? 'high' : 'medium'
            });
        }

        // 2. Identify declining trends
        for (const trend of progress.trends) {
            if (trend.trend === 'declining' && !results.some(r => r.skillId === trend.skill)) {
                const tags = SKILL_TO_TAGS[trend.skill] || [];

                // Get one medium problem for recovery
                const { data: trendProblems } = await supabase
                    .from('problems')
                    .select('id, title, difficulty, external_url')
                    .eq('difficulty', 'medium')
                    .limit(1);

                results.push({
                    skillId: trend.skill,
                    title: `Reverse Declining Trend`,
                    description: `You've shown a slight dip in ${trend.skill.replace(/-/g, ' ')} across recent sessions. Let's get back on track.`,
                    suggestedProblems: (trendProblems || []).map((p: { id: string; title: string; difficulty: string; external_url?: string }) => ({
                        id: p.id,
                        title: p.title,
                        difficulty: p.difficulty,
                        external_url: p.external_url
                    })),
                    priority: 'medium'
                });
            }
        }

        return results;
    }
}
