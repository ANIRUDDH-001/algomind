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

    // Silent Observer Coaching Nudge
    ENABLE_SILENT_OBSERVER: {
        storageKey: 'feature_ENABLE_SILENT_OBSERVER',
        defaultValue: true,
        description: 'Show real-time coaching nudges during interview',
        requiresBrowserSupport: false,
    },

    // Whisper STT — server-controlled, client reflects server flag
    ENABLE_WHISPER_STT: {
        storageKey: 'feature_ENABLE_WHISPER_STT',
        defaultValue: true, // Phase 3a: Enabled by default — high quality STT for all users
        description: 'Use Groq Whisper for speech recognition (better accuracy, requires network)',
        requiresBrowserSupport: true,
    },

    // ── Phase 0 Flags ──────────────────────────────────────────────────

    // AWS Bedrock AI Models (primary AI provider when enabled)
    ENABLE_AWS_BEDROCK: {
        storageKey: 'feature_ENABLE_AWS_BEDROCK',
        defaultValue: false,
        description: 'AWS Bedrock AI — primary AI provider when ON. Models from model_routing DB table (Haiku for chat, gpt-oss-120b for analysis). Free providers become fallback.',
        requiresBrowserSupport: false,
    },

    // AWS Polly Neural TTS (primary when enabled)
    ENABLE_AWS_POLLY_TTS: {
        storageKey: 'feature_ENABLE_AWS_POLLY_TTS',
        defaultValue: false,
        description: 'AWS Polly Neural TTS (Kajal Indian English voice). Primary TTS when enabled; Groq/browser become fallback.',
        requiresBrowserSupport: false,
    },

    // AWS Polly for guest / unauthenticated users
    ENABLE_GUEST_POLLY_TTS: {
        storageKey: 'feature_ENABLE_GUEST_POLLY_TTS',
        defaultValue: false,
        description: 'Allow guest (unauthenticated) users to use AWS Polly TTS during demo sessions.',
        requiresBrowserSupport: false,
    },

    // AWS Transcribe (batch only)
    ENABLE_AWS_TRANSCRIBE_STT: {
        storageKey: 'feature_ENABLE_AWS_TRANSCRIBE_STT',
        defaultValue: false,
        description: 'AWS Transcribe for post-interview batch transcription enrichment. Audio staged via S3 automatically.',
        requiresBrowserSupport: false,
    },

    // AWS S3 (Transcribe audio staging only — NOT transcript storage)
    ENABLE_AWS_S3_STORAGE: {
        storageKey: 'feature_ENABLE_AWS_S3_STORAGE',
        defaultValue: false,
        description: 'AWS S3 for Transcribe audio staging only. Transcripts stay in Supabase JSONB.',
        requiresBrowserSupport: false,
    },

    // Learn Mode
    ENABLE_LEARN_MODE: {
        storageKey: 'feature_ENABLE_LEARN_MODE',
        defaultValue: false,
        description: 'AI tutor mode. User can learn concepts after poor performance.',
        requiresBrowserSupport: false,
    },

    // Comparative Analysis
    ENABLE_COMPARATIVE_ANALYSIS: {
        storageKey: 'feature_ENABLE_COMPARATIVE_ANALYSIS',
        defaultValue: true,
        description: 'Show side-by-side performance comparison when user retries a problem.',
        requiresBrowserSupport: false,
    },

    // Difficulty Modes
    ENABLE_DIFFICULTY_MODES: {
        storageKey: 'feature_ENABLE_DIFFICULTY_MODES',
        defaultValue: true,
        description: 'Difficulty-based interview modes: Warm-Up, Practice, Crunch, Sprint.',
        requiresBrowserSupport: false,
    },

    // Guest interview mode toggle
    ENABLE_GUEST_MODE: {
        storageKey: 'feature_ENABLE_GUEST_MODE',
        defaultValue: true,
        description: 'Allow unauthenticated users to run guest/demo interviews.',
        requiresBrowserSupport: false,
    },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export interface FeatureFlagValue {
    key: FeatureFlagKey;
    storageKey: string;
    defaultValue: boolean;
    description: string;
    requiresBrowserSupport: boolean;
    currentValue: boolean;
    browserSupported: boolean;
}


/**
 * Get feature flag value from localStorage with fallback to default
 */
export function getFeatureFlag(flag: FeatureFlagKey): boolean {
    // Special case for environment variable overrides
    if (flag === 'ENABLE_SMART_ROUTING') {
        const envVal = process.env.NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING;
        if (envVal !== undefined) {
            // Default to env var if localStorage is empty
            if (typeof window === 'undefined') return envVal === 'true';
            const stored = localStorage.getItem(FEATURE_FLAGS[flag].storageKey);
            if (stored === null) return envVal === 'true';
            return stored === 'true';
        }
    }

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

    // Check for Whisper STT support (MediaRecorder + getUserMedia)
    if (flag === 'ENABLE_WHISPER_STT') {
        return !!(
            typeof window !== 'undefined' &&
            window.MediaRecorder &&
            navigator.mediaDevices?.getUserMedia
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
export function getAllFeatureFlags(): FeatureFlagValue[] {
    return Object.entries(FEATURE_FLAGS).map(([key, config]) => ({
        key: key as FeatureFlagKey,
        ...config,
        currentValue: getFeatureFlag(key as FeatureFlagKey),
        browserSupported: checkBrowserSupport(key as FeatureFlagKey),
    }));
}
