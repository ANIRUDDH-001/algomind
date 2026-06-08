/**
 * @codesage
 * @file      src/lib/onboarding/manager.ts
 * @purpose   User onboarding state manager.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

// Use sessionStorage so onboarding shows on every new login/browser session
const ONBOARDING_SESSION_KEY = 'algomind_onboarding_shown_this_session';

// Show intro animation only once per browser session
export function shouldShowOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    // Show onboarding if not already shown in this session
    return !sessionStorage.getItem(ONBOARDING_SESSION_KEY);
}

export function markOnboardingComplete(): void {
    // Mark as complete for this session only
    sessionStorage.setItem(ONBOARDING_SESSION_KEY, 'true');
}

export function resetOnboarding(): void {
    // Clear session storage to show onboarding again
    sessionStorage.removeItem(ONBOARDING_SESSION_KEY);
}
