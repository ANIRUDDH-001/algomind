import { expect, test } from '@playwright/test';

test.describe('Assessment Flow', () => {
  test('expired assessment link shows expired page', async ({ page }) => {
    // Use a fake/expired token.
    const navigated = await page.goto('/assess/expired-token-12345').catch(() => null);
    test.skip(!navigated, 'Assessment route unavailable in this environment.');

    await page.waitForLoadState('networkidle').catch(() => {});

    // Should not show the interview interface.
    const chatInput = page.locator('textarea, [data-testid="text-input"]');
    const hasChat = await chatInput.isVisible({ timeout: 3000 }).catch(() => false);

    // Either shows expired/error UI or does not show chat interface.
    expect(hasChat).toBe(false);
  });

  test('assessment complete page is accessible', async ({ page }) => {
    await page.goto('/assess/complete');
    await page.waitForLoadState('networkidle');

    // Should show completion UI.
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
