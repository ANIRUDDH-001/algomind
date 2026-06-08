/**
 * @codesage
 * @file      src/hooks/useGlobalFeatureFlag.ts
 * @purpose   React hook to consume server-side feature flags with global caching and visibility-aware polling.
 * @tech      React, Fetch API
 * @connects  Calls internal flags API; Exported for global app feature toggling
 * @apis      GET /api/flags
 * @db        none
 * @state     Module-level global cache (_flagCache) and component state
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { FeatureFlagKey } from '@/lib/feature-flags';

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
    flag: FeatureFlagKey,
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

        // F6: Visibility-aware polling — pause when tab is hidden.
        let interval: ReturnType<typeof setInterval> | null = null;

        const startPolling = () => {
            if (interval) clearInterval(interval);
            interval = setInterval(refresh, CACHE_TTL_MS);
        };

        const stopPolling = () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible — immediate refresh + restart polling
                refresh();
                startPolling();
            } else {
                // Tab hidden — stop polling to save /api/flags calls
                stopPolling();
            }
        };

        // Start polling only if tab is currently visible
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            startPolling();
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        return () => {
            stopPolling();
            if (typeof document !== 'undefined') {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
        };
    }, [refresh]);

    return value;
}
