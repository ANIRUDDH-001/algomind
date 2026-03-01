'use client';

import { useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Manages session token auto-refresh only.
 * Auth state changes (SIGNED_IN / SIGNED_OUT) are handled exclusively by AuthProvider
 * to avoid multiple onAuthStateChange subscriptions firing the same events.
 */
export function useSessionPersistence(): void {
    useEffect(() => {
        const supabase = getSupabase();
        if (!supabase) return;

        // NOTE: Do NOT add onAuthStateChange here — AuthProvider already subscribes.
        // Multiple subscribers cause each Supabase auth event to appear N times in logs
        // and can cause cascading re-renders.

        // Token auto-refresh: Supabase normally handles this, but we add a belt-and-suspenders
        // refresh every 50 min as a safeguard against unexpected session expiry.
        const refreshInterval = setInterval(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await supabase.auth.refreshSession();
            }
        }, 50 * 60 * 1000); // 50 minutes

        // SIGNED_OUT cleanup: subscribe once, stripped of logging noise
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event: string) => {
                if (event === 'SIGNED_OUT') {
                    localStorage.removeItem('attempted_problems');
                    sessionStorage.clear();
                }
            }
        );

        return () => {
            subscription.unsubscribe();
            clearInterval(refreshInterval);
        };
    }, []);
}
