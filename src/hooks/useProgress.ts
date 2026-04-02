'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { getProgressStore } from '@/lib/supabase/progress-store';
import { SessionHistory, UserProgress } from '@/types/assessment';
import { isSupabaseConfigured } from '@/lib/supabase/client';
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
            // Authenticated user — fetch real data
            if (user?.id && isSupabaseConfigured()) {
                const supabaseStore = getProgressStore();
                return await supabaseStore.getUserProgress(user.id);
            }

            // No user — nothing to show
            return null;
        },
        enabled: !!user?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // Mutation for adding a session
    const addSessionMutation = useMutation({
        mutationFn: async (session: SessionHistory) => {
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
