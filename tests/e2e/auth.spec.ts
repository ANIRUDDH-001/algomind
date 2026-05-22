import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('sign in with valid credentials redirects to dashboard', async ({ page }) => {
    test.skip(
      !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
      'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for credential sign-in test'
    );

    await page.goto('/login');
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 });

    await page.fill('[data-testid="email-input"]', process.env.TEST_USER_EMAIL!);
    await page.fill('[data-testid="password-input"]', process.env.TEST_USER_PASSWORD!);
    await page.click('[data-testid="sign-in-button"]');

    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });
  });

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/learn');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('protected learn/[slug] routes redirect to login', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('dashboard requires authentication', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('sign in page loads with form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('[data-testid="email-input"]', { timeout: 5000 });

    expect(await page.locator('[data-testid="email-input"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="password-input"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="sign-in-button"]').isVisible()).toBe(true);
  });
});

test.describe('Session Expiration', () => {
  // Uses default storageState (authenticated)
  test('expired session redirects to login', async ({ page }) => {
    // 1. Go to dashboard to ensure we are logged in
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // 2. Manipulate localStorage to set an expired token
    await page.evaluate(() => {
      // Force real auth to avoid the test bypass in AuthProvider
      localStorage.setItem('playwright-force-real-auth', 'true');
      
      const keys = Object.keys(localStorage);
      const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (authKey) {
        const tokenData = localStorage.getItem(authKey);
        if (tokenData) {
          const parsed = JSON.parse(tokenData);
          // Set expiry to 1 hour in the past and invalidate refresh token
          parsed.expires_at = Math.floor(Date.now() / 1000) - 3600;
          parsed.refresh_token = 'invalid_refresh_token';
          localStorage.setItem(authKey, JSON.stringify(parsed));
        }
      }
    });

    // Clear the E2E bypass cookie so Next.js proxy middleware performs a real check and redirects
    await page.context().clearCookies({ name: 'playwright-e2e' });

    // 3. Reload. Next.js middleware should detect expired/missing session and redirect to login
    await page.reload();

    // 4. Verify it redirects to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
