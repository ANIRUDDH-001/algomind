import { test, expect } from '@playwright/test';

test.describe('Diagnostic Flow', () => {
  test('shows diagnostic assessment page or auth redirect', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn/diagnostic')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    const heading = page.locator('h1:has-text("Diagnostic")');
    const welcome = page.locator('text=Welcome to AlgoMind!');

    const hasHeading = await heading.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasWelcome = await welcome.first().isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasHeading || hasWelcome).toBe(true);
  });

  test('diagnostic page loads without crash overlays', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('diagnostic shell exposes voice/chat surface', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('/login')) {
      await expect(page).toHaveURL(/\/login/);
      return;
    }

    if (!page.url().includes('/learn/diagnostic')) {
      await expect(page.locator("text=Your journey hasn't started yet!")).toBeVisible();
      return;
    }

    const tapPrompt = page.locator('text=Tap to answer');
    const micButton = page.locator('button:has(svg)').first();

    const hasTapPrompt = await tapPrompt.first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasMicButton = await micButton.isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasTapPrompt || hasMicButton).toBe(true);
  });
});
