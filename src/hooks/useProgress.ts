'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProgressStore } from '@/lib/supabase/progress-store';
import { CognitiveSkill, SessionHistory, SkillTrend, UserProgress } from '@/types/assessment';
import { calculateTrend } from '@/lib/assessment/trend-calculator';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isDemoMode, getDemoProgress } from '@/lib/demo/manager';

export function useProgress() {
    const { user } = useAuth();
    const [history, setHistory] = useState<SessionHistory[]>([]);
    const [overview, setOverview] = useState<UserProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        // Check if demo mode is enabled - return demo data
        if (isDemoMode()) {
            const demoData = getDemoProgress();

            if (demoData) {
                setHistory(demoData.sessions);
                setOverview({
                    userId: 'demo-user',
                    totalSessions: demoData.totalSessions,
                    averageScore: demoData.averageScore,
                    averageScores: demoData.averageScores,
                    trends: demoData.trends.map(t => ({
                        skill: t.skill as CognitiveSkill,
                        trend: t.trend,
                        change: t.change,
                        recentScores: []
                    })),
                    sessions: demoData.sessions,
                    lastUpdated: new Date(demoData.lastUpdated)
                });
            }
            setIsLoading(false);
            return;
        }

        // Require both Supabase and logged in user for real data
        if (!isSupabaseConfigured() || !user?.id) {
            setHistory([]);
            setOverview(null);
            setIsLoading(false);
            return;
        }

        try {
            const supabaseStore = getProgressStore();
            const progress = await supabaseStore.getUserProgress(user.id);

            if (!progress || progress.sessions.length === 0) {
                setHistory([]);
                setOverview(null);
                setIsLoading(false);
                return;
            }

            const userHistory = progress.sessions;
            setHistory(userHistory);

            // Calculate Averages and Trends
            const averages: Record<CognitiveSkill, number> = {} as any;
            const trends: SkillTrend[] = [];

            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                const skill = skillId as CognitiveSkill;
                const scores = userHistory
                    .map(s => s.skills[skill])
                    .filter(s => s !== undefined && s > 0)
                    .reverse();

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
                userId: user.id,
                totalSessions: userHistory.length,
                averageScore: Math.round(totalAvg * 10) / 10,
                averageScores: averages,
                trends,
                sessions: userHistory,
                lastUpdated: new Date()
            });

        } catch (e: any) {
            console.error('📊 [useProgress] Failed to load progress:', e);
            setError(e.message || "Failed to load progress");
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    const addSession = async (session: SessionHistory) => {
        // In demo mode, don't save to database
        if (isDemoMode()) {
            return;
        }

        if (!isSupabaseConfigured() || !user?.id) {
            console.error('❌ [useProgress] Cannot save - Supabase not configured or user not logged in');
            throw new Error('Please log in to save your progress');
        }

        try {
            const supabaseStore = getProgressStore();
            await supabaseStore.saveSession(user.id, session);

            // Refresh the data
            await fetchProgress();
        } catch (e: any) {
            console.error('❌ [useProgress] Failed to save session:', e);
            throw e;
        }
    };

    return {
        progress: overview,
        history,
        isLoading,
        error,
        refresh: fetchProgress,
        addSession
    };
}
