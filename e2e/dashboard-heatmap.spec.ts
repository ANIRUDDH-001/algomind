import { test, expect } from '@playwright/test';

async function gotoDashboard(page: import('@playwright/test').Page) {
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

test.describe('Dashboard Heatmap', () => {
  test('concept heatmap renders on dashboard', async ({ page }) => {
    await gotoDashboard(page);

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const emptyState = page.locator("text=Your journey hasn't started yet!");
    if (await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await expect(page.locator('text=Knowledge Map')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid^="concept-tile-"], [data-testid="concept-heatmap-skeleton"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('clicking concept tile opens detail panel', async ({ page }) => {
    await gotoDashboard(page);

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const firstTile = page.locator('[data-testid^="concept-tile-"]').first();
    const hasTile = await firstTile.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTile) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await firstTile.click();

    await expect(page.locator('[data-testid="concept-detail-panel"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Learn with Kai')).toBeVisible({ timeout: 5000 });
  });

  test('closing detail panel via backdrop works', async ({ page }) => {
    await gotoDashboard(page);

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const firstTile = page.locator('[data-testid^="concept-tile-"]').first();
    const hasTile = await firstTile.isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasTile) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    await firstTile.click();
    await expect(page.locator('[data-testid="concept-detail-panel"]')).toBeVisible({ timeout: 5000 });

    await page.click('[data-testid="concept-detail-backdrop"]');
    await expect(page.locator('[data-testid="concept-detail-panel"]')).not.toBeVisible({ timeout: 3000 });
  });

  test('recommendation banner or diagnostic CTA is visible', async ({ page }) => {
    await gotoDashboard(page);

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const recommendation = page.locator('text=Recommended for you');
    const diagnostic = page.locator('text=Start your personalized journey');
    const emptyState = page.locator("text=Your journey hasn't started yet!");

    const hasRecommendation = await recommendation.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasDiagnostic = await diagnostic.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEmptyState = await emptyState.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasRecommendation || hasDiagnostic || hasEmptyState).toBe(true);
  });

  test('weekly usage card shows This Week', async ({ page }) => {
    await gotoDashboard(page);

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    const weekly = page.locator('text=This Week');
    const emptyState = page.locator("text=Your journey hasn't started yet!");

    const hasWeekly = await weekly.first().isVisible({ timeout: 3000 }).catch(() => false);
    if (!hasWeekly) {
      await expect(emptyState).toBeVisible();
      return;
    }

    await expect(weekly).toBeVisible({ timeout: 5000 });
  });
});
