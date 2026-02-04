import { UserProgress, CognitiveSkill } from '@/types/assessment';
import recommendations from '@/data/problem-recommendations.json';

export interface Recommendation {
    skillId: CognitiveSkill;
    title: string;
    description: string;
    suggestedProblems: Array<{
        id: string;
        title: string;
        difficulty: string;
    }>;
    priority: 'high' | 'medium' | 'low';
}

export class RecommendationEngine {
    analyze(progress: UserProgress): Recommendation[] {
        if (!progress || progress.totalSessions === 0) return [];

        const results: Recommendation[] = [];

        // 1. Identify lowest scores (Weaknesses)
        const sortedSkills = Object.entries(progress.averageScores)
            .sort(([, a], [, b]) => a - b);

        const weakestSkills = sortedSkills.slice(0, 2);

        weakestSkills.forEach(([skillId, score]) => {
            const id = skillId as CognitiveSkill;
            const suggestions = (recommendations as any)[id] || [];

            results.push({
                skillId: id,
                title: `Boost your ${id.replace(/-/g, ' ')}`,
                description: `Your average score of ${score.toFixed(1)} suggests room for growth here. Practice these problems to improve.`,
                suggestedProblems: suggestions,
                priority: score < 5 ? 'high' : 'medium'
            });
        });

        // 2. Identify declining trends
        progress.trends.forEach(trend => {
            if (trend.trend === 'declining' && !results.some(r => r.skillId === trend.skill)) {
                const suggestions = (recommendations as any)[trend.skill] || [];
                results.push({
                    skillId: trend.skill,
                    title: `Reverse Declining Trend`,
                    description: `You've shown a slight dip in ${trend.skill.replace(/-/g, ' ')} across recent sessions. Let's get back on track.`,
                    suggestedProblems: suggestions,
                    priority: 'medium'
                });
            }
        });

        return results;
    }
}
