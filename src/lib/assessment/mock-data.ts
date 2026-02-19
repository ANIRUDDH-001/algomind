import { CognitiveSkill } from '@/types/assessment';
import { SessionHistory } from './progress-store';

export function generateMockProgress(count: number, userId: string = 'demo-user'): SessionHistory[] {
    const sessions: SessionHistory[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - count);

    const skillStartingPoints: Record<CognitiveSkill, number> = {
        'problem-decomposition': 4,
        'pattern-recognition': 3,
        'algorithmic-thinking': 4,
        'complexity-analysis': 2,
        'communication-clarity': 5,
        'edge-case-awareness': 3,
        'optimization-mindset': 2,
        'debugging-approach': 4,
    };

    for (let i = 0; i < count; i++) {
        const timestamp = new Date(baseDate);
        timestamp.setDate(timestamp.getDate() + i);
        timestamp.setHours(10 + (i % 8), 15 * (i % 4));

        const skills: Record<CognitiveSkill, number> = {} as any; // initialized empty, filled below
        Object.entries(skillStartingPoints).forEach(([skill, base]) => {
            // Gradual improvement logic with some randomness
            const progress = (i / count) * 4; // up to +4 points over time
            const random = (Math.random() - 0.5) * 1.5; // variance
            skills[skill as CognitiveSkill] = Math.max(1, Math.min(10, Math.round(base + progress + random)));
        });

        // Weighted average approx
        const overallScore = Object.values(skills).reduce((a, b) => a + b, 0) / 8;

        sessions.push({
            sessionId: `mock-${i}`,
            userId,
            problemId: ['two-sum', 'valid-anagram', 'merge-sorted-array'][i % 3],
            problemDifficulty: ['easy', 'medium', 'hard'][i % 3] as any,
            timestamp,
            duration: 600 + (Math.random() * 600),
            skills: skills,
            overallScore: Math.round(overallScore * 10) / 10
        });
    }

    return sessions.reverse(); // Newest first
}
