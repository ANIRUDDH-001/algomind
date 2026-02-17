'use client';

/**
 * Feature Flag System — localStorage + env-var override.
 *
 * Usage:
 *   import { getFlag, setFlag, FEATURE_FLAGS } from '@/lib/feature-flags';
 *   const enabled = getFlag('ENABLE_VAD_INTERRUPTIONS');
 */

// ─── Flag Definitions ──────────────────────────────────────────────
export const FEATURE_FLAGS = {
    ENABLE_VAD_INTERRUPTIONS: false,   // User can interrupt AI mid-speech
    ENABLE_SMART_ROUTING: false,       // Route between STT providers by quality
    ENABLE_CHUNKED_RESPONSES: false,   // Stream AI response chunks to TTS
    ENABLE_RESPONSE_CACHE: false,      // Cache AI responses for common queries
} as const;

export type FeatureFlagName = keyof typeof FEATURE_FLAGS;

const STORAGE_KEY = 'algomind_feature_flags';

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

// ─── Core helpers ──────────────────────────────────────────────────

function readOverrides(): Partial<Record<FeatureFlagName, boolean>> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeOverrides(overrides: Partial<Record<FeatureFlagName, boolean>>): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    // Dispatch a storage event so other tabs / useFeatureFlag hooks react
    window.dispatchEvent(new Event('featureflagschange'));
}

/**
 * Read the effective value of a feature flag.
 * Priority: env override > localStorage override > default.
 */
export function getFlag(name: FeatureFlagName): boolean {
    // 1. Env override (compile-time via NEXT_PUBLIC_FF_*)
    const envKey = `NEXT_PUBLIC_FF_${name}`;
    const envVal = (typeof process !== 'undefined' && process.env)
        ? process.env[envKey]
        : undefined;
    if (envVal !== undefined) return envVal === 'true' || envVal === '1';

    // 2. localStorage override
    const overrides = readOverrides();
    if (name in overrides) return overrides[name]!;

    // 3. Default
    return FEATURE_FLAGS[name];
}

/** Set a flag override in localStorage. */
export function setFlag(name: FeatureFlagName, value: boolean): void {
    const overrides = readOverrides();
    overrides[name] = value;
    writeOverrides(overrides);
}

/** Reset a flag to its compiled default (remove override). */
export function resetFlag(name: FeatureFlagName): void {
    const overrides = readOverrides();
    delete overrides[name];
    writeOverrides(overrides);
}

/** Get all flags with their current effective values. */
export function getAllFlags(): Record<FeatureFlagName, boolean> {
    const result: Record<string, boolean> = {};
    for (const name of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
        result[name] = getFlag(name);
    }
    return result as Record<FeatureFlagName, boolean>;
}
