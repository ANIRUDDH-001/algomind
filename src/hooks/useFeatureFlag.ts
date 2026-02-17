'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFlag, setFlag, type FeatureFlagName } from '@/lib/feature-flags';

/**
 * React hook for reading (and optionally writing) a feature flag.
 *
 * Reactively updates when the flag is changed from anywhere
 * (same tab, other tab via storage event, or admin panel).
 *
 * @example
 * const [vadEnabled, setVadEnabled] = useFeatureFlag('ENABLE_VAD_INTERRUPTIONS');
 * if (vadEnabled) { … }
 */
export function useFeatureFlag(
    name: FeatureFlagName
): [boolean, (value: boolean) => void] {
    const [value, setValue] = useState(() => getFlag(name));

    useEffect(() => {
        // Re-read whenever our custom event or the native storage event fires
        const sync = () => setValue(getFlag(name));
        window.addEventListener('featureflagschange', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('featureflagschange', sync);
            window.removeEventListener('storage', sync);
        };
    }, [name]);

    const toggle = useCallback(
        (newValue: boolean) => {
            setFlag(name, newValue);
            setValue(newValue);
        },
        [name]
    );

    return [value, toggle];
}
