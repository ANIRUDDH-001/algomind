import { useState, useEffect, useCallback } from 'react';
import { ProgressStore } from '@/lib/assessment/progress-store';
import { CognitiveSkill, SessionHistory, SkillTrend, UserProgress } from '@/types/assessment';
import { calculateTrend } from '@/lib/assessment/trend-calculator';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';

export function useProgress(userId: string = 'default-user') {
    const [history, setHistory] = useState<SessionHistory[]>([]);
    const [overview, setOverview] = useState<UserProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const store = new ProgressStore();
            const userHistory = await store.getUserHistory(userId);
            setHistory(userHistory);

            if (userHistory.length === 0) {
                setOverview(null);
                setIsLoading(false);
                return;
            }

            // Calculate Averages and Trends
            const averages: any = {};
            const trends: SkillTrend[] = [];

            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                const skill = skillId as CognitiveSkill;
                const scores = userHistory.map(s => s.skills[skill]).filter(s => s !== undefined).reverse(); // chronologically
                const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                averages[skill] = Math.round(avg * 10) / 10;

                const analysis = calculateTrend(scores);
                trends.push({
                    skill,
                    ...analysis,
                    recentScores: scores.slice(-5)
                });
            });

            const totalAvg = userHistory.reduce((acc, s) => acc + s.overallScore, 0) / userHistory.length;

            setOverview({
                userId,
                totalSessions: userHistory.length,
                averageScore: Math.round(totalAvg * 10) / 10,
                averageScores: averages,
                trends,
                sessions: userHistory,
                lastUpdated: new Date()
            });
        } catch (e: any) {
            setError(e.message || "Failed to load progress");
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    const addSession = async (session: SessionHistory) => {
        const store = new ProgressStore();
        await store.saveSession(session);
        await fetchProgress();
    };

    return {
        progress: overview,
        isLoading,
        error,
        refresh: fetchProgress,
        addSession
    };
}
