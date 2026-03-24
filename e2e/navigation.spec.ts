import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

test.describe('Navigation', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for authenticated navigation tests'
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('Learn link appears in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    const learnLink = page.locator('[data-testid="nav-learn"]');
    await expect(learnLink).toBeVisible();
  });

  test('clicking Learn in sidebar navigates to /learn', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="nav-learn"]');
    await expect(page).toHaveURL('/learn');
  });

  test('Settings link is accessible', async ({ page }) => {
    await page.goto('/dashboard');
    const settingsLink = page.locator('[data-testid="nav-settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test('back button on learn session returns to learn page', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="back-button"]', { timeout: 5000 });

    await page.click('[data-testid="back-button"]');
    await expect(page).toHaveURL('/learn');
  });

  test('navigating between concept sessions works', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').nth(1).click();
    await page.waitForSelector('[data-testid="detail-panel-learn-button"]');

    await page.click('[data-testid="detail-panel-learn-button"]');
    await expect(page).toHaveURL(/\/learn\/[\w-]+$/);
  });

  test('dashboard has proper heading', async ({ page }) => {
    await page.goto('/dashboard');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });
});
