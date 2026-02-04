'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getProgressStore, SupabaseProgressStore } from '@/lib/supabase/progress-store';
import { ProgressStore } from '@/lib/assessment/progress-store';
import { CognitiveSkill, SessionHistory, SkillTrend, UserProgress } from '@/types/assessment';
import { calculateTrend } from '@/lib/assessment/trend-calculator';
import { SKILL_DEFINITIONS } from '@/lib/assessment/skill-registry';
import { isSupabaseConfigured } from '@/lib/supabase/client';

export function useProgress() {
    const { user } = useAuth();
    const [history, setHistory] = useState<SessionHistory[]>([]);
    const [overview, setOverview] = useState<UserProgress | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            let userHistory: SessionHistory[] = [];

            // Try Supabase first if configured and user is logged in
            if (isSupabaseConfigured() && user?.id) {
                console.log('📊 [useProgress] Loading from Supabase for user:', user.id);
                const supabaseStore = getProgressStore();
                const progress = await supabaseStore.getUserProgress(user.id);

                if (progress && progress.sessions.length > 0) {
                    console.log('📊 [useProgress] Found', progress.sessions.length, 'sessions in Supabase');
                    userHistory = progress.sessions;
                }
            }

            // Fallback to local storage if no Supabase data
            if (userHistory.length === 0) {
                console.log('📊 [useProgress] Loading from local storage');
                const localStore = new ProgressStore();
                userHistory = await localStore.getUserHistory(user?.id || 'default-user');
            }

            setHistory(userHistory);

            if (userHistory.length === 0) {
                setOverview(null);
                setIsLoading(false);
                return;
            }

            // Calculate Averages and Trends
            const averages: Record<CognitiveSkill, number> = {} as any;
            const trends: SkillTrend[] = [];

            Object.keys(SKILL_DEFINITIONS).forEach((skillId) => {
                const skill = skillId as CognitiveSkill;
                const scores = userHistory
                    .map(s => s.skills[skill])
                    .filter(s => s !== undefined && s > 0)
                    .reverse(); // chronologically

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
                userId: user?.id || 'default-user',
                totalSessions: userHistory.length,
                averageScore: Math.round(totalAvg * 10) / 10,
                averageScores: averages,
                trends,
                sessions: userHistory,
                lastUpdated: new Date()
            });

            console.log('📊 [useProgress] Progress loaded successfully:', {
                totalSessions: userHistory.length,
                averageScore: Math.round(totalAvg * 10) / 10
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
        console.log('💾 [useProgress] Saving session...');

        try {
            // Save to Supabase if configured
            if (isSupabaseConfigured() && user?.id) {
                console.log('💾 [useProgress] Saving to Supabase');
                const supabaseStore = getProgressStore();
                await supabaseStore.saveSession(user.id, session);
                console.log('✅ [useProgress] Saved to Supabase');
            }

            // Also save to local storage as backup
            console.log('💾 [useProgress] Saving to local storage');
            const localStore = new ProgressStore();
            await localStore.saveSession(session);
            console.log('✅ [useProgress] Saved to local storage');

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
