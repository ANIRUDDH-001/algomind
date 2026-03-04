'use client';

/**
 * F3: Gutted — session persistence is now handled entirely by AuthProvider.
 *
 * The previous implementation created a duplicate onAuthStateChange subscription
 * and a redundant 50-min refreshSession() interval that fights Supabase's
 * built-in auto-refresh.
 *
 * localStorage cleanup on sign-out has been moved to AuthProvider's
 * onAuthStateChange handler.
 *
 * This hook is a no-op kept for backward compatibility.
 */
export function useSessionPersistence(): void {
    // No-op: All session management is in AuthProvider
}
