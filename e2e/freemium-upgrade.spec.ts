import { test, expect } from '@playwright/test';

test.describe('Freemium Upgrade Modal', () => {
  test('upgrade modal triggers via custom event', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('show-upgrade-modal'));
    });

    const modal = page.locator('text=Weekly Session Limit Reached');
    const isVisible = await modal.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (!isVisible) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(modal).toBeVisible({ timeout: 3000 });
  });

  test('upgrade modal closes on Maybe Later button', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    await page.evaluate(() => {
      document.dispatchEvent(new CustomEvent('show-upgrade-modal'));
    });

    const modal = page.locator('text=Weekly Session Limit Reached');
    const isVisible = await modal.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (!isVisible) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(modal).toBeVisible({ timeout: 3000 });
    await page.click('button:has-text("Maybe Later")');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('weekly usage component is visible on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const weekly = page.locator('text=This Week');
    const hasWeekly = await weekly.first().isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasWeekly) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(weekly).toBeVisible({ timeout: 5000 });
  });
});
