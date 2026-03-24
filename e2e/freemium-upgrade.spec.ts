import { test, expect } from '@playwright/test';
import { signIn, getCurrentUserId } from './helpers/auth';
import { setWeeklyUsage } from './helpers/api';

test.describe('Freemium Gate', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD || !process.env.TEST_API_SECRET,
    'TEST_USER_EMAIL, TEST_USER_PASSWORD, and TEST_API_SECRET are required for freemium gate tests'
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('session limit bar appears in header for free users', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="session-limit-bar"]', { timeout: 5000 });

    expect(await page.locator('[data-testid="session-limit-bar"]').isVisible()).toBe(true);
  });

  test('limit bar shows correct remaining sessions', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    // Set usage to 3 out of 5
    await setWeeklyUsage(page, userId, 3);

    await page.goto('/dashboard');
    await page.waitForSelector('[data-testid="session-limit-bar"]', { timeout: 5000 });

    const text = await page.locator('[data-testid="session-limit-bar"]').textContent();
    expect(text).toContain('2'); // 5 - 3 = 2 remaining
  });

  test('upgrade modal appears when limit is reached', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    // Max out the limit
    await setWeeklyUsage(page, userId, 5);

    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="upgrade-modal"]', { timeout: 10000 });

    expect(await page.locator('[data-testid="upgrade-modal"]').isVisible()).toBe(true);
  });

  test('upgrade modal displays correct usage info', async ({ page }) => {
    const userId = await getCurrentUserId(page);
    await setWeeklyUsage(page, userId, 5);

    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="upgrade-modal"]');

    const title = await page.locator('[data-testid="upgrade-modal-title"]').textContent();
    expect(title).toContain('5/5');
  });

  test('upgrade modal can be closed', async ({ page }) => {
    const userId = await getCurrentUserId(page);
    await setWeeklyUsage(page, userId, 5);

    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="upgrade-modal"]');

    await page.click('[data-testid="upgrade-modal-close"]');
    await expect(page).toHaveURL('/learn');
  });

  test('free users can access learn page normally when under limit', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    // Set usage to 2 out of 5
    await setWeeklyUsage(page, userId, 2);

    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    expect(await page.locator('[data-testid="upgrade-modal"]').isHidden()).toBe(true);
  });
  });
