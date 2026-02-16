'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { getProgressStore } from '@/lib/supabase/progress-store';
import { SessionHistory, UserProgress } from '@/types/assessment';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { isDemoMode, getDemoProgress } from '@/lib/demo/manager';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useProgress() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Query for fetching progress
    const {
        data: overview,
        isLoading,
        error
    } = useQuery({
        queryKey: ['user-progress', user?.id],
        queryFn: async () => {
            // 1. Demo Mode
            if (isDemoMode()) {
                const demoData = getDemoProgress();
                if (!demoData) return null;

                // Return in UserProgress format
                return {
                    userId: 'demo-user',
                    totalSessions: demoData.totalSessions,
                    averageScore: demoData.averageScore,
                    averageScores: demoData.averageScores,
                    trends: demoData.trends,
                    sessions: demoData.sessions,
                    lastUpdated: new Date(demoData.lastUpdated)
                } as UserProgress;
            }

            // 2. Real Data
            if (!isSupabaseConfigured() || !user?.id) {
                return null;
            }

            const supabaseStore = getProgressStore();
            return await supabaseStore.getUserProgress(user.id);
        },
        enabled: !!user?.id || isDemoMode(),
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // Mutation for adding a session
    const addSessionMutation = useMutation({
        mutationFn: async (session: SessionHistory) => {
            if (isDemoMode()) return; // Demo mode doesn't save to DB

            if (!isSupabaseConfigured() || !user?.id) {
                throw new Error('Please log in to save your progress');
            }

            const supabaseStore = getProgressStore();
            await supabaseStore.saveSession(user.id, session);
        },
        onSuccess: () => {
            // Invalidate and refetch
            queryClient.invalidateQueries({ queryKey: ['user-progress', user?.id] });
            toast.success("Session saved successfully!");
        },
        onError: (err) => {
            console.error('Failed to save session:', err);
            toast.error("Failed to save session. Please try again.");
        }
    });

    return {
        progress: overview || null,
        history: overview?.sessions || [],
        isLoading,
        error: error ? (error as Error).message : null,
        refresh: () => queryClient.invalidateQueries({ queryKey: ['user-progress', user?.id] }),
        addSession: addSessionMutation.mutateAsync,
        isSaving: addSessionMutation.isPending
    };
}
