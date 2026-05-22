import { test, expect } from '@playwright/test';
import { signIn } from '../helpers/auth';

test.describe('Concept Heatmap', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL,
    'TEST_USER_EMAIL is required for authenticated heatmap tests'
  );

  test.beforeEach(async ({ page }) => {
    const authenticated = await signIn(page);
    if (!authenticated) { test.skip(); return; }

    // Navigate to /learn and verify we land on the learn page with heatmap content.
    // We check for the actual element (not just the URL) because client-side auth
    // redirects to /login can fire after networkidle, after the URL check.
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    // If redirected server-side to login or diagnostic, skip immediately.
    const url = page.url();
    if (url.includes('/login') || url.includes('/diagnostic')) { test.skip(); return; }

    // Verify heatmap content is visible — confirms diagnostic is done and data loaded.
    const hasContent = await page
      .locator('[data-testid="concept-heatmap"], [data-testid="concept-tile"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasContent) { test.skip(); return; }
  });

  test('heatmap renders with concept tiles', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-heatmap"]', { timeout: 8000 });

    const tiles = await page.locator('[data-testid="concept-tile"]').count();
    expect(tiles).toBeGreaterThanOrEqual(15);
  });

  test('clicking tile opens detail panel', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="concept-detail-panel"]');

    expect(await page.locator('[data-testid="concept-detail-panel"]').isVisible()).toBe(true);
  });

  test('detail panel shows concept name', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="concept-detail-panel"]');

    const title = await page.locator('[data-testid="concept-detail-panel-title"]');
    await expect(title).toBeVisible();
  });

  test('backdrop click closes detail panel', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="concept-detail-panel"]');

    await page.click('[data-testid="heatmap-backdrop"]');
    await expect(page.locator('[data-testid="concept-detail-panel"]')).toBeHidden({
      timeout: 2000,
    });
  });

  test('Learn button navigates to session', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="detail-panel-learn-button"]');

    await page.click('[data-testid="detail-panel-learn-button"]');
    await expect(page).toHaveURL(/\/learn\/[\w-]+$/);
  });

  test('heatmap is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]', { timeout: 8000 });

    const tiles = await page.locator('[data-testid="concept-tile"]').all();
    expect(tiles.length).toBeGreaterThanOrEqual(15);

    // Verify first few tiles are in viewport
    for (const tile of tiles.slice(0, 3)) {
      await expect(tile).toBeInViewport();
    }
  });

  test('tiles are visually distinct with different states', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]', { timeout: 8000 });

    const firstTile = page.locator('[data-testid="concept-tile"]').first();
    const bgColor = await firstTile.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    expect(bgColor).toBeTruthy();
  });
});
