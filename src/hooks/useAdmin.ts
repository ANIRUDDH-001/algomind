'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';

// Module-level cache to avoid hitting DB on every mount
let _adminStatusCache: { isAdmin: boolean; userId: string; expiresAt: number } | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
        if (process.env.NODE_ENV !== 'production' &&
            typeof document !== 'undefined' &&
            document.cookie.includes('playwright-e2e=true')) {
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

            // ✅ FIX: Check cache before hitting DB
            const now = Date.now();
            if (_adminStatusCache &&
                _adminStatusCache.userId === user.id &&
                _adminStatusCache.expiresAt > now) {
                setIsAdmin(_adminStatusCache.isAdmin);
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
                // ✅ FIX: Update cache after successful check
                _adminStatusCache = {
                    isAdmin: !!data,
                    userId: user.id,
                    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS
                };
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
