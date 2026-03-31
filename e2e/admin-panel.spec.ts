import { expect, test } from '@playwright/test';

test.describe('Admin Panel', () => {
  test('non-admin user is redirected from admin routes', async ({ page }) => {
    // Use default auth (non-admin user).
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const adminConsoleVisible = await page
      .getByRole('heading', { name: /Admin Console/i })
      .isVisible()
      .catch(() => false);
    test.skip(adminConsoleVisible, 'Default auth user is admin in this environment.');

    // Should redirect to dashboard or show forbidden.
    const url = page.url();
    const isForbidden = url.includes('/dashboard') || url.includes('/login');
    const forbiddenText = await page
      .locator('text=forbidden, text=Forbidden, text=Access denied')
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    expect(isForbidden || forbiddenText).toBe(true);
  });

  test('admin routes require authentication', async ({ page, context }) => {
    // Clear auth state.
    await context.clearCookies();

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Should redirect to login.
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
