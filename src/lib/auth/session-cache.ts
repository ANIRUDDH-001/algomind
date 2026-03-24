/**
 * @module session-cache
 *
 * CLIENT-SIDE ONLY module.
 *
 * This module maintains a write-only in-memory record of the current session
 * for the AuthProvider. It is populated client-side via onAuthStateChange events.
 *
 * IMPORTANT: Do NOT import this module in server components, API routes, or
 * middleware. Server-side auth must always call `supabase.auth.getUser()` directly
 * using the @supabase/ssr server client.
 *
 * In Vercel serverless, module state CAN persist between requests within the same
 * warm worker. Reading identity from this cache server-side would be a security
 * vulnerability. There is intentionally no read path exposed from this module.
 */

interface CachedSession {
    userId: string;
    validatedAt: number;   // timestamp when session was last validated
    jwtExpiresAt: number;  // JWT exp timestamp in ms
}

// Write-only from AuthProvider. Read path removed — not needed in serverless.
let _cache: CachedSession | null = null;

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
