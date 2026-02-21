/**
 * Feature Flags for Voice Interview System
 * Use these to control rollout and disable features if issues arise
 */

export const FEATURE_FLAGS = {
    // Voice Activity Detection - Natural interruptions
    ENABLE_VAD_INTERRUPTIONS: {
        storageKey: 'feature_ENABLE_VAD_INTERRUPTIONS',
        defaultValue: true, // Enabled by default - user can disable in settings if mic issues occur
        description: 'Enable Voice Activity Detection for natural interruptions',
        requiresBrowserSupport: true,
    },

    // Smart Routing - Groq vs Gemini
    ENABLE_SMART_ROUTING: {
        storageKey: 'feature_ENABLE_SMART_ROUTING',
        defaultValue: true, // ENABLE by default (improves latency)
        description: 'Route simple queries to Groq, complex to Gemini',
        requiresBrowserSupport: false,
    },

    // Response Chunking - Streaming TTS
    ENABLE_CHUNKED_RESPONSES: {
        storageKey: 'feature_ENABLE_CHUNKED_RESPONSES',
        defaultValue: true, // ENABLE by default (better perceived latency)
        description: 'Stream responses sentence-by-sentence for faster TTS',
        requiresBrowserSupport: false,
    },

    // Response Caching
    ENABLE_RESPONSE_CACHE: {
        storageKey: 'feature_ENABLE_RESPONSE_CACHE',
        defaultValue: false, // DISABLED by default (in-memory only, not suitable for serverless)
        description: 'Cache common interview responses for instant retrieval',
        requiresBrowserSupport: false,
    },

    // Hinglish Support
    ENABLE_HINGLISH_SUPPORT: {
        storageKey: 'feature_ENABLE_HINGLISH_SUPPORT',
        defaultValue: true, // ENABLE by default (user preference)
        description: 'Allow interviews in Hinglish (Hindi + English mix)',
        requiresBrowserSupport: false,
    },

    // Silent Observer Coaching Nudge
    ENABLE_SILENT_OBSERVER: {
        storageKey: 'feature_ENABLE_SILENT_OBSERVER',
        defaultValue: true,
        description: 'Show real-time coaching nudges during interview',
        requiresBrowserSupport: false,
    },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Get feature flag value from localStorage with fallback to default
 */
export function getFeatureFlag(flag: FeatureFlagKey): boolean {
    if (typeof window === 'undefined') {
        return FEATURE_FLAGS[flag].defaultValue;
    }

    const stored = localStorage.getItem(FEATURE_FLAGS[flag].storageKey);
    if (stored === null) {
        return FEATURE_FLAGS[flag].defaultValue;
    }

    return stored === 'true';
}

/**
 * Set feature flag value in localStorage
 */
export function setFeatureFlag(flag: FeatureFlagKey, value: boolean): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FEATURE_FLAGS[flag].storageKey, value.toString());
    // Dispatch event for hook updates
    window.dispatchEvent(new StorageEvent('storage', {
        key: FEATURE_FLAGS[flag].storageKey, // Ensure this matches what we look for
        newValue: value.toString(),
        storageArea: localStorage,
    }));
}

/**
 * Check if browser supports a feature that requires browser APIs
 */
export function checkBrowserSupport(flag: FeatureFlagKey): boolean {
    if (!FEATURE_FLAGS[flag].requiresBrowserSupport) {
        return true;
    }

    // Check for VAD support (AudioContext + MediaStream)
    if (flag === 'ENABLE_VAD_INTERRUPTIONS') {
        interface WindowWithWebkit extends Window {
            webkitAudioContext?: typeof AudioContext;
        }
        return !!(
            typeof window !== 'undefined' &&
            (window.AudioContext || (window as unknown as WindowWithWebkit).webkitAudioContext) &&
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia
        );
    }

    return true;
}

// ─── A/B Assignment (sticky per device) ────────────────────────────
const AB_STORAGE_KEY = 'algomind_ab_group';

/** Returns a stable group (0-99) for the current device. */
export function getABGroup(): number {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(AB_STORAGE_KEY);
    if (stored !== null) return Number(stored);
    const group = Math.floor(Math.random() * 100);
    localStorage.setItem(AB_STORAGE_KEY, String(group));
    return group;
}

/** Check if the current device is in the "treatment" cohort (0-49 = true). */
export function isInTreatmentGroup(): boolean {
    return getABGroup() < 50;
}

/**
 * Reset a flag to its compiled default (remove override).
 */
export function resetFlag(flag: FeatureFlagKey): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(FEATURE_FLAGS[flag].storageKey);
    // Dispatch event to update hooks
    window.dispatchEvent(new StorageEvent('storage', {
        key: FEATURE_FLAGS[flag].storageKey,
        newValue: null,
        storageArea: localStorage,
    }));
}

/**
 * Get all feature flags with their current values and support status
 */
export function getAllFeatureFlags() {
    return Object.entries(FEATURE_FLAGS).map(([key, config]) => ({
        key: key as FeatureFlagKey,
        ...config,
        currentValue: getFeatureFlag(key as FeatureFlagKey),
        browserSupported: checkBrowserSupport(key as FeatureFlagKey),
    }));
}
