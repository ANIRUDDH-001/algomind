'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';

// F5: Module-level cache for admin RPC result (5-min TTL)
let _adminStatusCache: { isAdmin: boolean; userId: string; expiresAt: number } | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Dedup concurrent admin checks
let _pendingCheck: Promise<boolean> | null = null;

/**
 * F5: Hook to check if current user is an admin.
 * Uses AuthProvider context for user identity (no separate getUser() call).
 * Caches RPC result for 5 minutes at module level.
 */
export function useAdmin() {
    const { user, loading: authLoading } = useAuth();
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const checkAdminStatus = useCallback(async () => {
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

        // F5: Use user from AuthProvider context — no separate getUser() call
        if (!user?.id) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        try {
            // Check module-level cache first
            const now = Date.now();
            if (_adminStatusCache &&
                _adminStatusCache.userId === user.id &&
                _adminStatusCache.expiresAt > now) {
                setIsAdmin(_adminStatusCache.isAdmin);
                setLoading(false);
                return;
            }

            const supabase = getSupabase();
            if (!supabase) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            // Dedup concurrent admin checks
            if (!_pendingCheck) {
                _pendingCheck = (async () => {
                    const { data, error: dbError } = await supabase.rpc('check_is_admin');
                    if (dbError) {
                        console.warn('Admin check error:', dbError);
                        return false;
                    }
                    const result = !!data;
                    _adminStatusCache = {
                        isAdmin: result,
                        userId: user.id,
                        expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
                    };
                    return result;
                })();
            }

            const result = await _pendingCheck;
            _pendingCheck = null;
            setIsAdmin(result);
        } catch (err) {
            _pendingCheck = null;
            console.error('Failed to check admin status:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        // Wait for AuthProvider to finish loading before checking admin
        if (!authLoading) {
            checkAdminStatus();
        }
    }, [authLoading, checkAdminStatus]);

    return { isAdmin, loading: loading || authLoading, error, refetch: checkAdminStatus };
}
