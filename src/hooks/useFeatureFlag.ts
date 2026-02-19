import { useEffect, useState } from 'react';
import { getFeatureFlag, setFeatureFlag, checkBrowserSupport, type FeatureFlagKey } from '@/lib/feature-flags';

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
            // We check for the specific key OR if the event key is the flag name (which we might use in our custom dispatch)
            // The custom dispatch in setFeatureFlag uses the flag name as the key? 
            // Actually in feature-flags.ts I implemented: 
            // window.dispatchEvent(new StorageEvent('storage', { key: flag ... }))
            // The key in FEATURE_FLAGS[flag].key is like 'feature_ENABLE_...' but let's check what I wrote.
            // In feature-flags.ts, I'm using `FEATURE_FLAGS[flag].key` for localStorage, 
            // but dispatching with `key: flag` might be inconsistent if I'm not careful.
            // Let's re-read feature-flags.ts content I'm writing above.

            // Wait, in feature-flags.ts I wrote:
            // localStorage.setItem(FEATURE_FLAGS[flag].key, value.toString());
            // window.dispatchEvent(new StorageEvent('storage', { key: flag ... })); 
            // AND 
            // getFeatureFlag uses `FEATURE_FLAGS[flag].key`.

            // So if I dispatch with `key: flag` (e.g. 'ENABLE_VAD...'), but localStorage uses 'feature_ENABLE_VAD...',
            // I need to be careful.
            // The simplest is to listen for ANY storage event and re-read.

            // But let's stick to the prompt's simplicity first, but make it robust.
            // I'll just re-read the value on any storage event to be safe, or match keys.

            // Better:
            // In setFeatureFlag, I should probably dispatch with the correct localStorage key? 
            // Or just re-read.

            // Let's rely on the fact that `getFeatureFlag` reads from localStorage.
            // If `e.key` matches `FEATURE_FLAGS[flag].key`, we update.
            import('@/lib/feature-flags').then(({ FEATURE_FLAGS }) => {
                if (e.key === FEATURE_FLAGS[flag].storageKey || e.key === flag) {
                    setEnabled(getFeatureFlag(flag));
                }
            });
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
