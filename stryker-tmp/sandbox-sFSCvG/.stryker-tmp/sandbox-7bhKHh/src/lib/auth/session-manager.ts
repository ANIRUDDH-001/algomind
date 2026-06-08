// @ts-nocheck
// 
'use client';
/**
 * @codesage
 * @file      src/lib/auth/session-manager.ts
 * @purpose   Authentication guards, roles, and session management.
 * @tech      Node.js, NextAuth / Auth handlers
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Session state
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */

/**
 * F3: Gutted — session persistence is now handled entirely by AuthProvider.
 *
 * The previous implementation created a duplicate onAuthStateChange subscription
 * (BUG-08) and a redundant 50-min refreshSession() interval that fights
 * Supabase's built-in auto-refresh (BUG-11).
 *
 * localStorage cleanup on sign-out has been moved to AuthProvider's
 * onAuthStateChange handler.
 *
 * This hook is kept as a no-op for backward compatibility with any
 * existing mount sites. It can be safely removed in a future cleanup.
 */
export function useSessionPersistence(): void {
    // No-op: All session management is in AuthProvider
}
