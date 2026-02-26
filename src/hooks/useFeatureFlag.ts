/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { getFeatureFlag, setFeatureFlag, checkBrowserSupport, FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';

/**
 * React hook for feature flags with live updates
 */
export function useFeatureFlag(flag: FeatureFlagKey) {
    const [enabled, setEnabled] = useState(() => getFeatureFlag(flag));

    useEffect(() => {
        // Initial sync
        setEnabled(getFeatureFlag(flag));

        // Listen for storage changes from other tabs/windows or same window dispatch
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === FEATURE_FLAGS[flag].storageKey || e.key === flag) {
                setEnabled(getFeatureFlag(flag));
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [flag]);

    const toggle = (value: boolean) => {
        setFeatureFlag(flag, value);
        setEnabled(value);
    };

    return { enabled, toggle };
}

/**
 * Hook to check if feature is enabled AND browser supports it
 */
export function useFeatureFlagWithSupport(flag: FeatureFlagKey) {
    const { enabled, toggle } = useFeatureFlag(flag);
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        // Check browser support on mount
        setSupported(checkBrowserSupport(flag));
    }, [flag]);

    return {
        enabled: enabled && supported,
        toggle,
        supported,
    };
}
