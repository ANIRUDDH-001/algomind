/**
 * Assessment JWT secret helper.
 *
 * SECURITY NOTE: ASSESSMENT_JWT_SECRET must be a unique, high-entropy secret
 * that is NEVER the same value as SUPABASE_JWT_SECRET. Sharing the same secret
 * between Supabase auth tokens and assessment tokens allows cross-token forgery:
 * an attacker with their own valid Supabase JWT could forge an assessment token
 * using the same signing secret.
 *
 * Generate a suitable secret:
 *   openssl rand -hex 32
 *
 * Set it in your environment:
 *   ASSESSMENT_JWT_SECRET=<64-char hex string>
 */

/**
 * Returns the raw assessment JWT secret string.
 * Throws at call time if ASSESSMENT_JWT_SECRET is not set.
 * Never falls back to SUPABASE_JWT_SECRET.
 */
export function getAssessmentSecret(): string {
    const secret = process.env.ASSESSMENT_JWT_SECRET;

    if (!secret) {
        throw new Error(
            '[Assessment JWT] ASSESSMENT_JWT_SECRET is not set. ' +
            'Add it to your environment variables. ' +
            'Generate one with: openssl rand -hex 32 \n' +
            'IMPORTANT: This must be a different value from SUPABASE_JWT_SECRET — ' +
            'sharing the same secret between Supabase auth tokens and assessment tokens ' +
            'enables cross-token forgery attacks.'
        );
    }

    // Enforce minimum entropy — catch placeholder values like "secret" or "test"
    if (secret.length < 32) {
        throw new Error(
            `[Assessment JWT] ASSESSMENT_JWT_SECRET is too short (${secret.length} chars, minimum 32). ` +
            'Generate a suitable secret with: openssl rand -hex 32'
        );
    }

    return secret;
}

/**
 * Returns the assessment JWT secret encoded as Uint8Array for use with jose.
 */
export function encodeAssessmentSecret(): Uint8Array {
    return new TextEncoder().encode(getAssessmentSecret());
}

/**
 * Validates that ASSESSMENT_JWT_SECRET is not the same value as SUPABASE_JWT_SECRET.
 * Call this from validateEnv.ts during startup.
 */
export function assertAssessmentSecretIsUnique(): void {
    const assessmentSecret = process.env.ASSESSMENT_JWT_SECRET;
    const supabaseSecret = process.env.SUPABASE_JWT_SECRET;

    if (
        assessmentSecret &&
        supabaseSecret &&
        assessmentSecret === supabaseSecret
    ) {
        throw new Error(
            '[Assessment JWT] FATAL: ASSESSMENT_JWT_SECRET and SUPABASE_JWT_SECRET ' +
            'are set to the same value. This enables cross-token forgery attacks. ' +
            'Generate a new ASSESSMENT_JWT_SECRET with: openssl rand -hex 32'
        );
    }
}
