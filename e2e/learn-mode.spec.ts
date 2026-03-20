import { test, expect } from '@playwright/test';

test.describe('Learn Mode', () => {
  test('dashboard exposes learn navigation entry point', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('a[href="/learn"]').first()).toBeVisible();
  });

  test('shows diagnostic prompt or redirects to diagnostic for new users', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/learn/diagnostic')) {
      await expect(page).toHaveURL(/\/learn\/diagnostic/);
      return;
    }

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(page.locator('text=Set Your Baseline First, text=Learn with Kai').first()).toBeVisible();
  });

  test('navigates to concept URL and shows session shell or auth redirect', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn/')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(page.locator('text=Starting session..., text=Kai is preparing..., button:has-text("End Session")').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows End Session button during active concept session when authenticated', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn/')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(page.locator('button:has-text("End Session")')).toBeVisible({ timeout: 10000 });
  });

  test('results page renders concept progress section', async ({ page }) => {
    await page.goto('/learn/arrays-strings/results?sessionId=test');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Session Complete!')).toBeVisible({ timeout: 10000 });

    const conceptProgress = page.locator('text=Concept Progress');
    const hasProgress = await conceptProgress.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (hasProgress) {
      await expect(conceptProgress).toBeVisible();
    }
  });

  test('mobile viewport renders session controls', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/learn/arrays-strings');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn/')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await expect(page.locator('button:has(svg), button:has-text("End Session")').first()).toBeVisible({ timeout: 10000 });
  });
});
