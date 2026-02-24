/**
 * Server-Side Feature Flags
 *
 * Centralised registry of feature flags that are controlled server-side.
 * These differ from the client-side localStorage flags in feature-flags.ts:
 *   - Values are authoritative from the server (env vars / DB).
 *   - Clients fetch them via GET /api/flags and cache briefly.
 *   - Admins can flip them via PATCH /api/flags (updates env-override map).
 *
 * Adding a new flag:
 *   1. Add an entry to SERVER_FLAGS below.
 *   2. Optionally add a NEXT_PUBLIC_FF_<NAME> env var to override the default.
 *   3. Use `getGlobalFeatureFlag(name)` in API routes.
 *   4. Use `useGlobalFeatureFlag(name)` in React components.
 */

// ---------------------------------------------------------------------------
// Flag Definition
// ---------------------------------------------------------------------------

export interface ServerFlagDef {
    /** Human-readable description shown in admin UI. */
    description: string;
    /** Compiled default when no env var or runtime override exists. */
    defaultValue: boolean;
    /** Optional: env var name that can override the default at deploy time. */
    envVar?: string;
}

export const SERVER_FLAGS = {
    ENABLE_WHISPER_STT: {
        description: 'Use Groq Whisper for speech recognition (better accuracy, requires network)',
        defaultValue: false,
        envVar: 'NEXT_PUBLIC_FF_ENABLE_WHISPER_STT',
    },
    // Future flags go here — e.g.
    // ENABLE_REALTIME_COLLAB: { ... },
    // MAINTENANCE_MODE: { ... },
} as const satisfies Record<string, ServerFlagDef>;

export type ServerFlagKey = keyof typeof SERVER_FLAGS;

// ---------------------------------------------------------------------------
// Runtime Override Map (in-memory, per-process)
// ---------------------------------------------------------------------------
// In serverless (Vercel), this is per-cold-start. For persistent overrides,
// store in DB (Supabase) and load on init. For now, env vars + this map.

const _runtimeOverrides = new Map<ServerFlagKey, boolean>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read a single flag value.
 * Priority: runtime override > env var > compiled default.
 */
export function getGlobalFeatureFlag(flag: ServerFlagKey): boolean {
    // 1. Runtime override (set via admin API)
    if (_runtimeOverrides.has(flag)) {
        return _runtimeOverrides.get(flag)!;
    }

    // 2. Environment variable override
    const def = SERVER_FLAGS[flag];
    if (def.envVar) {
        const envVal = process.env[def.envVar];
        if (envVal !== undefined) {
            return envVal === 'true';
        }
    }

    // 3. Compiled default
    return def.defaultValue;
}

/**
 * Set a runtime override for a flag (survives until cold restart).
 * Called by admin API routes.
 */
export function setGlobalFeatureFlag(flag: ServerFlagKey, value: boolean): void {
    _runtimeOverrides.set(flag, value);
}

/**
 * Clear a runtime override so the flag falls back to env/default.
 */
export function clearGlobalFeatureFlag(flag: ServerFlagKey): void {
    _runtimeOverrides.delete(flag);
}

/**
 * Return all flags with their resolved values (for admin UI / client fetch).
 */
export function getAllGlobalFeatureFlags(): Record<ServerFlagKey, { value: boolean; description: string }> {
    const result: Record<string, { value: boolean; description: string }> = {};
    for (const [key, def] of Object.entries(SERVER_FLAGS)) {
        result[key] = {
            value: getGlobalFeatureFlag(key as ServerFlagKey),
            description: def.description,
        };
    }
    return result as Record<ServerFlagKey, { value: boolean; description: string }>;
}
