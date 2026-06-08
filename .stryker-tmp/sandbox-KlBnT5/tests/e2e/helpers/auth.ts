// @ts-nocheck
import { Page } from '@playwright/test';

/**
 * signIn — navigates to the dashboard using the pre-established session from
 * global-setup (injected via storageState from .playwright/auth.json).
 *
 * Returns true when authenticated, false when no session is available.
 * Callers in beforeEach should call test.skip() on false:
 *
 *   test.beforeEach(async ({ page }) => {
 *     const ok = await signIn(page);
 *     test.skip(!ok, 'Auth not available');
 *   });
 */
export async function signIn(page: Page): Promise<boolean> {
  await page.goto('/dashboard', { waitUntil: 'load' });

  // If the server redirected us to /login, the session is not valid.
  if (page.url().includes('/login')) return false;

  // Wait for a nav element that is only rendered after Supabase client-side
  // confirms the session is valid. This is a stronger signal than localStorage:
  // an expired token will be present in localStorage but the nav will never
  // appear because the SDK clears the session and redirects.
  const navVisible = await page
    .locator('[data-testid="nav-learn"], [data-testid="nav-home"], [data-testid="avatar-button"]')
    .first()
    .isVisible({ timeout: 8000 })
    .catch(() => false);

  return navVisible;
}

export async function signOut(page: Page) {
  await page.goto('/settings');
  await page.waitForSelector('[data-testid="sign-out-button"]', { timeout: 5000 });
  await page.click('[data-testid="sign-out-button"]');
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * Get the current authenticated user's ID from the authenticated API.
 */
export async function getCurrentUserId(page: Page): Promise<string> {
  const res = await page.request.get('/api/user/me');
  if (!res.ok()) {
    throw new Error(`Failed to fetch current user: ${res.status()}`);
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error('Current user id missing in /api/user/me response');
  }

  return data.id;
}
