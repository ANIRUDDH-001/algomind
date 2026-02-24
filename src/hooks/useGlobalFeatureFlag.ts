'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerFlagKey } from '@/lib/feature-flags-server';

/**
 * React hook to consume a server-side feature flag.
 *
 * Fetches GET /api/flags on mount and caches globally so multiple
 * hooks sharing the same page don't create duplicate requests.
 *
 * Returns `defaultValue` until the first fetch completes (typically < 100ms).
 */

// ---------------------------------------------------------------------------
// Module-level cache (shared across all hook instances in the same page)
// ---------------------------------------------------------------------------

interface FlagEntry {
    value: boolean;
    description: string;
}

let _flagCache: Record<string, FlagEntry> | null = null;
let _fetchPromise: Promise<void> | null = null;
let _lastFetchTime = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

async function fetchFlags(): Promise<void> {
    const now = Date.now();
    if (_flagCache && now - _lastFetchTime < CACHE_TTL_MS) return;

    // Deduplicate concurrent fetches
    if (_fetchPromise) {
        await _fetchPromise;
        return;
    }

    _fetchPromise = (async () => {
        try {
            const res = await fetch('/api/flags');
            if (res.ok) {
                _flagCache = await res.json();
                _lastFetchTime = Date.now();
            }
        } catch {
            // Silently fail — keep stale cache or defaults
        } finally {
            _fetchPromise = null;
        }
    })();

    await _fetchPromise;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGlobalFeatureFlag(
    flag: ServerFlagKey,
    defaultValue = false,
): boolean {
    const [value, setValue] = useState(() => {
        if (_flagCache && flag in _flagCache) {
            return _flagCache[flag].value;
        }
        return defaultValue;
    });

    const flagRef = useRef(flag);
    useEffect(() => { flagRef.current = flag; }, [flag]);

    const refresh = useCallback(async () => {
        await fetchFlags();
        if (_flagCache && flagRef.current in _flagCache) {
            setValue(_flagCache[flagRef.current].value);
        }
    }, []);

    useEffect(() => {
        refresh();

        // Periodic refresh
        const interval = setInterval(refresh, CACHE_TTL_MS);
        return () => clearInterval(interval);
    }, [refresh]);

    return value;
}
