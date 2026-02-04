const ONBOARDING_KEY = 'algomind_onboarding_complete';

export function shouldShowOnboarding(): boolean {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(ONBOARDING_KEY);
}

export function markOnboardingComplete(): void {
    localStorage.setItem(ONBOARDING_KEY, 'true');
}

export function resetOnboarding(): void {
    localStorage.removeItem(ONBOARDING_KEY);
}
