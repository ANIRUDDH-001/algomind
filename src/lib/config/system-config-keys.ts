/**
 * @module system-config-keys
 * @description Typed constants for all system_config keys used in application code.
 *              Single source of truth — add new keys here, not inline.
 * @phase Phase 1C
 */

export const SYSTEM_CONFIG_KEYS = {
    // AI routing
    CROSS_TIER_FALLBACK_ENABLED: 'cross_tier_fallback_enabled',
    PRIMARY_OWNER_EMAIL: 'primary_owner_email',

    // Freemium gate (Phase 1C)
    FREE_TIER_WEEKLY_SESSION_LIMIT: 'free_tier_weekly_session_limit',
    ENABLE_SESSION_GATING: 'enable_session_gating',

    // Knowledge graph weights (Phase 1C)
    CONCEPT_CONFIDENCE_INTERVIEW_WEIGHT: 'concept_confidence_interview_weight',
    CONCEPT_CONFIDENCE_TUTOR_WEIGHT: 'concept_confidence_tutor_weight',
    CONCEPT_CONFIDENCE_STRUGGLE_PENALTY: 'concept_confidence_struggle_penalty',
} as const;

export type SystemConfigKey = typeof SYSTEM_CONFIG_KEYS[keyof typeof SYSTEM_CONFIG_KEYS];

// Default values — used when DB is unavailable or key missing
export const SYSTEM_CONFIG_DEFAULTS: Record<SystemConfigKey, string> = {
    [SYSTEM_CONFIG_KEYS.CROSS_TIER_FALLBACK_ENABLED]: 'true',
    [SYSTEM_CONFIG_KEYS.PRIMARY_OWNER_EMAIL]: '',
    [SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_SESSION_LIMIT]: '5',
    [SYSTEM_CONFIG_KEYS.ENABLE_SESSION_GATING]: 'true',
    [SYSTEM_CONFIG_KEYS.CONCEPT_CONFIDENCE_INTERVIEW_WEIGHT]: '0.2',
    [SYSTEM_CONFIG_KEYS.CONCEPT_CONFIDENCE_TUTOR_WEIGHT]: '0.08',
    [SYSTEM_CONFIG_KEYS.CONCEPT_CONFIDENCE_STRUGGLE_PENALTY]: '-0.04',
};
