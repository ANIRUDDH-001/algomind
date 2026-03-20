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
