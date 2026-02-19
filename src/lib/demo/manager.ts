const DEMO_MODE_KEY = 'algomind_demo_mode';
import { SessionHistory } from '@/lib/assessment/progress-store';
import { CognitiveSkill } from '@/types/assessment';

export function isDemoMode(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function enableDemoMode(): void {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
}

export function disableDemoMode(): void {
    localStorage.removeItem(DEMO_MODE_KEY);
}

// Get demo progress data for display
export function getDemoProgress() {
    return generateImpressiveDemoData();
}

// Generate impressive demo data showing clear progression
function generateImpressiveDemoData() {
    const sessions: SessionHistory[] = [];

    // Start with moderate scores, show clear progression
    const baseScores: Record<string, number> = {
        'problem-decomposition': 5.5,
        'pattern-recognition': 5.0,
        'algorithmic-thinking': 5.8,
        'complexity-analysis': 4.5,
        'communication-clarity': 6.0,
        'edge-case-handling': 4.8,
        'debugging-skills': 5.2,
        'code-quality': 5.5,
    };

    const problemNames = [
        'Two Sum',
        'Valid Parentheses',
        'Merge Sorted Arrays',
        'Binary Tree Traversal',
        'Linked List Cycle',
        'LRU Cache',
        'Word Search',
        'Merge Intervals',
        'Coin Change',
        'Longest Substring',
        'Course Schedule',
        'Word Ladder',
    ];

    for (let i = 0; i < 12; i++) {
        const improvement = i * 0.28; // Gradual improvement
        const sessionScores: Record<string, number> = {};

        Object.entries(baseScores).forEach(([skill, base]) => {
            // Add improvement + some variance for realism
            const variance = (Math.random() - 0.5) * 0.6;
            sessionScores[skill] = Math.min(10, Math.max(1, base + improvement + variance));
        });

        const overallScore = Object.values(sessionScores).reduce((a, b) => a + b, 0) / 8;

        sessions.unshift({
            sessionId: `demo-session-${12 - i}`,
            userId: 'demo-user',
            problemId: problemNames[i] || `problem-${i}`,
            problemDifficulty: i < 4 ? 'easy' : i < 8 ? 'medium' : 'hard',
            timestamp: new Date(Date.now() - (11 - i) * 24 * 60 * 60 * 1000),
            duration: 300 + Math.floor(Math.random() * 600), // 5-15 minutes
            skills: sessionScores,
            overallScore,
        });
    }

    // Calculate average scores from latest sessions
    const avgScores: Record<string, number> = {};
    Object.keys(baseScores).forEach(skill => {
        const sum = sessions.slice(0, 5).reduce((acc, s) => acc + (s.skills[skill as CognitiveSkill] || 0), 0);
        avgScores[skill] = sum / 5;
    });

    return {
        userId: 'demo-user',
        sessions,
        totalSessions: sessions.length,
        averageScores: avgScores,
        averageScore: Object.values(avgScores).reduce((a, b) => a + b, 0) / 8,
        trends: Object.keys(baseScores).map(skill => ({
            skill,
            trend: 'improving' as const,
            change: 15 + Math.random() * 10,
        })),
        lastUpdated: new Date().toISOString(),
    };
}
