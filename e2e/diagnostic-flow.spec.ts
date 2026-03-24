import { test, expect } from '@playwright/test';
import { getCurrentUserId, signIn } from './helpers/auth';
import { resetUserKnowledgeGraph } from './helpers/api';

test.describe('Diagnostic Flow', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for authenticated diagnostic tests'
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('redirects to diagnostic for new user with no concepts', async ({ page }) => {
    test.skip(!process.env.TEST_API_SECRET, 'TEST_API_SECRET is required for reset-kg test API route');

    // Reset KG to simulate new user
    const userId = await getCurrentUserId(page);
    await resetUserKnowledgeGraph(page, userId);

    await page.goto('/learn');
    await page.waitForURL('/learn/diagnostic', { timeout: 10000 });
    expect(page.url()).toContain('/learn/diagnostic');
  });

  test('shows diagnostic opening message from assistant', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    const firstMessage = await page
      .locator('[data-testid="message-assistant"]')
      .first()
      .textContent();
    expect(firstMessage).toBeTruthy();
    expect(firstMessage!.length).toBeGreaterThan(20);
  });

  test('mic input control toggles listening state', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    await expect(page.locator('text=Tap to answer')).toBeVisible();
    await page.click('[data-testid="send-button"]');
    await expect(page.locator('text=Listening...')).toBeVisible();
  });

  test('turn counter is visible in active diagnostic session', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForSelector('[data-testid="turn-counter"]', { timeout: 5000 });

    const counter = await page.locator('[data-testid="turn-counter"]').textContent();
    expect(counter).toContain('left');
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
    await page.waitForSelector('[data-testid="send-button"]', { timeout: 5000 });

    const micButton = page.locator('[data-testid="send-button"]');
    await expect(micButton).toBeVisible();
    await expect(micButton).toBeEnabled();
  });
});
