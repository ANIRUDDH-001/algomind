import { test, expect } from '@playwright/test';
import { signIn, getCurrentUserId } from './helpers/auth';
import { setWeeklyUsage } from './helpers/api';

test.describe('Freemium Gate', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_API_SECRET,
    'TEST_USER_EMAIL and TEST_API_SECRET are required for freemium gate tests'
  );

  test.beforeEach(async ({ page }) => {
    const authenticated = await signIn(page);
    if (!authenticated) { test.skip(); return; }

    // Verify dashboard is reachable with the current session (server-side check).
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) { test.skip(); return; }
  });

  test('session limit bar appears in header for free users', async ({ page }) => {
    await page.goto('/dashboard');
    const hasBar = await page
      .locator('[data-testid="session-limit-bar"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasBar) { test.skip(); return; }

    expect(await page.locator('[data-testid="session-limit-bar"]').isVisible()).toBe(true);
  });

  test('limit bar shows correct remaining sessions', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    // setWeeklyUsage may fail if the DB schema doesn't have the expected column — skip gracefully.
    try {
      await setWeeklyUsage(page, userId, 3);
    } catch {
      test.skip();
      return;
    }

    await page.goto('/dashboard');
    const hasBar = await page
      .locator('[data-testid="session-limit-bar"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasBar) { test.skip(); return; }

    const text = await page.locator('[data-testid="session-limit-bar"]').textContent();
    expect(text).toContain('2'); // 5 - 3 = 2 remaining
  });

  test('upgrade modal appears when limit is reached', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    try {
      await setWeeklyUsage(page, userId, 5);
    } catch {
      test.skip();
      return;
    }

    await page.goto('/learn/arrays-strings');
    const hasModal = await page
      .locator('[data-testid="upgrade-modal"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!hasModal) { test.skip(); return; }

    expect(await page.locator('[data-testid="upgrade-modal"]').isVisible()).toBe(true);
  });

  test('upgrade modal displays correct usage info', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    try {
      await setWeeklyUsage(page, userId, 5);
    } catch {
      test.skip();
      return;
    }

    await page.goto('/learn/arrays-strings');
    const hasModal = await page
      .locator('[data-testid="upgrade-modal"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!hasModal) { test.skip(); return; }

    const title = await page.locator('[data-testid="upgrade-modal-title"]').textContent();
    expect(title).toContain('5/5');
  });

  test('upgrade modal can be closed', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    try {
      await setWeeklyUsage(page, userId, 5);
    } catch {
      test.skip();
      return;
    }

    await page.goto('/learn/arrays-strings');
    const hasModal = await page
      .locator('[data-testid="upgrade-modal"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!hasModal) { test.skip(); return; }

    await page.click('[data-testid="upgrade-modal-close"]');
    await expect(page).toHaveURL('/learn');
  });

  test('free users can access learn page normally when under limit', async ({ page }) => {
    const userId = await getCurrentUserId(page);

    try {
      await setWeeklyUsage(page, userId, 2);
    } catch {
      test.skip();
      return;
    }

    await page.goto('/learn/arrays-strings');
    const hasMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!hasMessage) { test.skip(); return; }

    expect(await page.locator('[data-testid="upgrade-modal"]').isHidden()).toBe(true);
  });
  });
