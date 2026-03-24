import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

test.describe('Learn Mode', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for authenticated learn mode tests'
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('learn page shows concept heatmap for returning users', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-heatmap"]', { timeout: 8000 });

    const tiles = await page.locator('[data-testid="concept-tile"]').count();
    expect(tiles).toBeGreaterThanOrEqual(15);
  });

  test('clicking concept tile opens detail panel', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]', { timeout: 8000 });

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="concept-detail-panel"]', { timeout: 3000 });
    expect(await page.locator('[data-testid="concept-detail-panel"]').isVisible()).toBe(true);
  });

  test('detail panel displays concept information', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="concept-detail-panel"]');

    const title = await page.locator('[data-testid="concept-detail-panel-title"]');
    await expect(title).toBeVisible();
  });

  test('Learn with Kai button navigates to session', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]');

    await page.locator('[data-testid="concept-tile"]').first().click();
    await page.waitForSelector('[data-testid="detail-panel-learn-button"]');

    await page.click('[data-testid="detail-panel-learn-button"]');
    await expect(page).toHaveURL(/\/learn\/[\w-]+$/);
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

  test('learn session shows opening message', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    const firstMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .textContent();
    expect(firstMessage).toBeTruthy();
    expect(firstMessage).toMatch(/\?/); // Kai asks a question
  });

  test('user can send message and receive response', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    await page.fill('textarea', 'Arrays store elements at contiguous memory locations');
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('[data-testid="message-user"]', { timeout: 5000 });
    await page.waitForSelector('[data-testid="message-assistant"]:nth-child(4)', {
      timeout: 15000,
    });

    const responseMessages = await page.locator('[data-testid="message-assistant"]').count();
    expect(responseMessages).toBeGreaterThan(1);
  });

  test('Finish button is disabled initially', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="finish-button"]', { timeout: 5000 });

    const finishButton = page.locator('[data-testid="finish-button"]');
    await expect(finishButton).toBeDisabled();
  });

  test('Finish button enables after multiple messages', async ({ page }) => {
    test.slow();
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    // Send 2-3 user messages
    for (let i = 0; i < 3; i++) {
      await page.fill('textarea', `Test message about arrays: point ${i + 1}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(10000); // Wait for AI response
    }

    const finishButton = page.locator('[data-testid="finish-button"]');
    await expect(finishButton).toBeEnabled({ timeout: 5000 });
  });

  test('invalid concept slug shows 404', async ({ page }) => {
    await page.goto('/learn/concept-that-does-not-exist-xyz');
    await page.waitForSelector('[data-testid="not-found-page"]', { timeout: 5000 });
    expect(await page.locator('[data-testid="not-found-page"]').isVisible()).toBe(true);
  });

  test('back button returns to learn page', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await page.waitForSelector('[data-testid="back-button"]', { timeout: 5000 });

    await page.click('[data-testid="back-button"]');
    await expect(page).toHaveURL('/learn');
  });

  test('heatmap is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/learn');
    await page.waitForSelector('[data-testid="concept-tile"]', { timeout: 8000 });

    const tiles = await page.locator('[data-testid="concept-tile"]').all();
    expect(tiles.length).toBeGreaterThanOrEqual(15);

    // Verify tiles are in viewport
    for (const tile of tiles.slice(0, 3)) {
      await expect(tile).toBeInViewport();
    }
  });
});
