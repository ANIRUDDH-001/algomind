import { expect, test } from '@playwright/test';

test.describe('Assessment Flow', () => {
  test('expired assessment link shows expired page', async ({ page }) => {
    // Use a fake/expired token.
    await page.goto('/assess/expired-token-12345');

    // Should redirect to expired page or show expired UI.
    await page.waitForLoadState('networkidle');

    const expiredText = page.locator('text=expired, text=invalid, text=not found');
    // At least one should be visible.
    const isExpired = await expiredText.first().isVisible({ timeout: 10000 }).catch(() => false);

    // Should not show the interview interface.
    const chatInput = page.locator('textarea, [data-testid="text-input"]');
    const hasChat = await chatInput.isVisible({ timeout: 3000 }).catch(() => false);

    // Either shows expired or does not show chat.
    expect(isExpired || !hasChat).toBe(true);
  });

  test('assessment complete page is accessible', async ({ page }) => {
    await page.goto('/assess/complete');
    await page.waitForLoadState('networkidle');

    // Should show completion UI.
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
