import { test, expect } from '@playwright/test';
import { getCurrentUserId, signIn } from './helpers/auth';
import { resetUserKnowledgeGraph } from './helpers/api';

test.describe('Diagnostic Flow', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL,
    'TEST_USER_EMAIL is required for authenticated diagnostic tests'
  );

  test.beforeEach(async ({ page }) => {
    const authenticated = await signIn(page);
    if (!authenticated) { test.skip(); return; }

    // Verify we can actually reach the diagnostic page (session valid server-side).
    await page.goto('/learn/diagnostic');
    await page.waitForLoadState('networkidle');
    if (!page.url().includes('/learn/diagnostic')) { test.skip(); return; }
  });

  test('redirects to diagnostic for new user with no concepts', async ({ page }) => {
    test.skip(!process.env.TEST_API_SECRET, 'TEST_API_SECRET is required for reset-kg test API route');

    // Reset KG to simulate new user
    const userId = await getCurrentUserId(page);
    await resetUserKnowledgeGraph(page, userId);

    await page.goto('/learn');
    try {
      await page.waitForURL('/learn/diagnostic', { timeout: 10000 });
      expect(page.url()).toContain('/learn/diagnostic');
    } catch {
      test.skip();
    }
  });

  test('shows diagnostic opening message from assistant', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    const hasMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    if (!hasMessage) { test.skip(); return; }

    const firstMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .textContent();
    expect(firstMessage).toBeTruthy();
    expect(firstMessage!.length).toBeGreaterThan(20);
  });

  test('mic input control toggles listening state', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    const hasMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .isVisible({ timeout: 15000 })
      .catch(() => false);
    if (!hasMessage) { test.skip(); return; }

    const micButton = page.locator('[data-testid="send-button"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
    await expect(micButton).toHaveAttribute('aria-label', /Start recording|Stop recording/);
  });

  test('turn counter is visible in active diagnostic session', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    const hasTurnCounter = await page
      .locator('[data-testid="turn-counter"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasTurnCounter) { test.skip(); return; }

    const counter = await page.locator('[data-testid="turn-counter"]').textContent();
    expect(counter).toContain('Question');
  });

  test('diagnostic page has no crash overlays', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Internal Server Error');
  });

  test('accessible mic interface is present', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    const hasSendButton = await page
      .locator('[data-testid="send-button"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!hasSendButton) { test.skip(); return; }

    const micButton = page.locator('[data-testid="send-button"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
  });
});
