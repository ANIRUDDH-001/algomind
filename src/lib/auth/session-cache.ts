/**
 * F1: Module-level session cache for reducing redundant auth calls.
 * Stores minimal validated session data in memory (not persisted).
 *
 * Used by: AuthProvider, middleware (via JWT decode), useAdmin
 */

interface CachedSession {
    userId: string;
    validatedAt: number;   // timestamp when session was last validated
    jwtExpiresAt: number;  // JWT exp timestamp in ms
}

let _cache: CachedSession | null = null;

/** Minimum JWT remaining life to trust cache (5 minutes) */
const MIN_JWT_REMAINING_MS = 5 * 60 * 1000;

/** Maximum age of a validated session before re-validation (15 minutes) */
const MAX_VALIDATION_AGE_MS = 15 * 60 * 1000;

/**
 * Check if the current cached session is still trusted.
 * Returns true if:
 * 1. Cache exists
 * 2. Was validated within the last 15 minutes
 * 3. JWT has > 5 minutes remaining
 */
export function isSessionTrusted(): boolean {
    if (!_cache) return false;

    const now = Date.now();
    const validationAge = now - _cache.validatedAt;
    const jwtRemaining = _cache.jwtExpiresAt - now;

    return validationAge < MAX_VALIDATION_AGE_MS && jwtRemaining > MIN_JWT_REMAINING_MS;
}

/**
 * Get the cached user ID if session is trusted.
 */
export function getCachedUserId(): string | null {
    return isSessionTrusted() ? _cache!.userId : null;
}

/**
 * Mark the session as validated after a successful auth check.
 * @param userId - The authenticated user's ID
 * @param jwtExpMs - JWT expiration time in milliseconds
 */
export function markSessionValid(userId: string, jwtExpMs: number): void {
    _cache = {
        userId,
        validatedAt: Date.now(),
        jwtExpiresAt: jwtExpMs,
    };
}

/**
 * Update the JWT expiry after a token refresh.
 * @param userId - The user ID (must match cached)
 * @param newExpMs - New JWT expiration in milliseconds
 */
export function markRefreshed(userId: string, newExpMs: number): void {
    if (_cache && _cache.userId === userId) {
        _cache.jwtExpiresAt = newExpMs;
        _cache.validatedAt = Date.now();
    } else {
        // Different user or no cache — create fresh entry
        markSessionValid(userId, newExpMs);
    }
}

/**
 * Clear the session cache (on sign-out).
 */
export function clearCache(): void {
    _cache = null;
}
