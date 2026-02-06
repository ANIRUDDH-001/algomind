'use client';

import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Manages session persistence and refresh
 * Helps prevent unexpected logouts
 */
export function useSessionPersistence() {
    useEffect(() => {
        const supabase = getSupabase();
        if (!supabase) return;

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: string, session: unknown) => {
                console.log('🔐 [SESSION] Auth event:', event);

                if (event === 'SIGNED_OUT') {
                    console.log('🔐 [SESSION] User signed out - clearing local data');
                    // Clear any cached data
                    localStorage.removeItem('attempted_problems');
                    sessionStorage.clear();
                }

                if (event === 'TOKEN_REFRESHED') {
                    console.log('🔐 [SESSION] Token refreshed successfully');
                }

                if (event === 'SIGNED_IN') {
                    console.log('🔐 [SESSION] User signed in');
                }
            }
        );

        // Refresh session every 50 minutes (tokens expire after 60 min)
        const refreshInterval = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                console.log('🔄 [SESSION] Refreshing token...');
                const { error } = await supabase.auth.refreshSession();

                if (error) {
                    console.error('❌ [SESSION] Refresh failed:', error);
                } else {
                    console.log('✅ [SESSION] Token refreshed');
                }
            }
        }, 50 * 60 * 1000); // 50 minutes

        return () => {
            subscription.unsubscribe();
            clearInterval(refreshInterval);
        };
    }, []);
}
