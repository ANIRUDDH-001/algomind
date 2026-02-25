'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getReviewQueue } from '@/app/actions/spaced-repetition';
import { useAuth } from '@/components/auth/AuthProvider';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedResult {
    count: number;
    timestamp: number;
}

// Module-level cache (persists across re-renders within the same page lifecycle)
let cachedResult: CachedResult | null = null;

export function useReviewCount() {
    const { user } = useAuth();
    const [count, setCount] = useState(cachedResult?.count ?? 0);
    const [isLoading, setIsLoading] = useState(!cachedResult);
    const fetchedRef = useRef(false);

    const fetchCount = useCallback(async () => {
        if (!user?.id) {
            setCount(0);
            setIsLoading(false);
            return;
        }

        // Check cache validity
        if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL_MS) {
            setCount(cachedResult.count);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const queue = await getReviewQueue(user.id);
            const newCount = queue.length;
            cachedResult = { count: newCount, timestamp: Date.now() };
            setCount(newCount);
        } catch {
            setCount(0);
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        if (!fetchedRef.current) {
            fetchedRef.current = true;
            fetchCount();
        }
    }, [fetchCount]);

    return { count, isLoading };
}

/** Reset cache — useful for testing */
export function _resetReviewCountCache() {
    cachedResult = null;
}
