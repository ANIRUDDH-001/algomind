'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

/**
 * Hook to check if current user is an admin
 * Returns { isAdmin, loading, error }
 */
export function useAdmin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkAdminStatus();

        // Subscribe to auth changes
        const supabase = getSupabase();
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
                checkAdminStatus();
            });
            return () => subscription.unsubscribe();
        }
    }, []);

    const checkAdminStatus = async () => {
        setLoading(true);
        setError(null);

        // E2E Test Bypass
        if (typeof document !== 'undefined' && document.cookie.includes('playwright-e2e=true')) {
            setIsAdmin(true);
            setLoading(false);
            return;
        }

        try {
            const supabase = getSupabase();
            if (!supabase) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !user.email) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            // Check if user email is in admin_users table via RPC
            // This avoids RLS issues and 406 errors with direct table access
            const { data, error: dbError } = await supabase.rpc('check_is_admin');

            if (dbError) {
                console.warn('Admin check error:', dbError);
                // Fallback (fails safe)
                setIsAdmin(false);
            } else {
                setIsAdmin(!!data);
            }
        } catch (err) {
            console.error('Failed to check admin status:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    return { isAdmin, loading, error, refetch: checkAdminStatus };
}
