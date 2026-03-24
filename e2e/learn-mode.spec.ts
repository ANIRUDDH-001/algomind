import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

async function maybeCompleteDiagnostic(page: import('@playwright/test').Page) {
  if (!page.url().includes('/learn/diagnostic')) return;

  await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

  for (let i = 0; i < 10; i++) {
    const finishButton = page.locator('[data-testid="finish-diagnostic-button"]');
    if (await finishButton.isEnabled()) break;

    await page.fill('[data-testid="text-input"]', `Diagnostic answer ${i + 1}`);
    await page.click('[data-testid="send-text-button"]');
    await page.waitForTimeout(700);
  }

  const finishButton = page.locator('[data-testid="finish-diagnostic-button"]');
  await expect(finishButton).toBeEnabled({ timeout: 10000 });
  await finishButton.click();
  await page.waitForURL('**/learn', { timeout: 15000 });
}

async function ensureLearnPage(page: import('@playwright/test').Page) {
  await page.goto('/learn');
  await maybeCompleteDiagnostic(page);
  await expect(page).toHaveURL(/\/learn$/);
}

test.describe('Learn Mode', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD,
    'TEST_USER_EMAIL and TEST_USER_PASSWORD are required for authenticated learn mode tests'
  );

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('learn page shows concept picker cards', async ({ page }) => {
    await ensureLearnPage(page);
    await page.waitForSelector('[data-testid^="concept-card-"]', { timeout: 8000 });

    const cards = await page.locator('[data-testid^="concept-card-"]').count();
    expect(cards).toBeGreaterThanOrEqual(8);
  });

  test('clicking concept card navigates to session', async ({ page }) => {
    await ensureLearnPage(page);
    await page.locator('[data-testid^="concept-card-"]').first().click();
    await expect(page).toHaveURL(/\/learn\/[\w-]+$/);
  });

  test('learn session shows opening message', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await maybeCompleteDiagnostic(page);
    if (!page.url().includes('/learn/arrays-strings')) {
      await page.goto('/learn/arrays-strings');
    }
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
    await maybeCompleteDiagnostic(page);
    if (!page.url().includes('/learn/arrays-strings')) {
      await page.goto('/learn/arrays-strings');
    }
    await page.waitForSelector('[data-testid="message-assistant"]', { timeout: 10000 });

    await page.fill('[data-testid="text-input"]', 'Arrays store elements at contiguous memory locations');
    await page.click('[data-testid="send-text-button"]');

    await page.waitForSelector('[data-testid="message-user"]', { timeout: 5000 });

    const responseMessages = await page.locator('[data-testid="message-assistant"]').count();
    expect(responseMessages).toBeGreaterThan(1);
  });

  test('Finish button is visible and enabled in active session', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await maybeCompleteDiagnostic(page);
    if (!page.url().includes('/learn/arrays-strings')) {
      await page.goto('/learn/arrays-strings');
    }
    await page.waitForSelector('[data-testid="finish-button"]', { timeout: 5000 });

    const finishButton = page.locator('[data-testid="finish-button"]');
    await expect(finishButton).toBeEnabled();
  });

  test('invalid concept slug shows 404', async ({ page }) => {
    await page.goto('/learn/concept-that-does-not-exist-xyz');
    await page.waitForSelector('[data-testid="not-found-page"]', { timeout: 5000 });
    expect(await page.locator('[data-testid="not-found-page"]').isVisible()).toBe(true);
  });

  test('back button returns to learn page', async ({ page }) => {
    await page.goto('/learn/arrays-strings');
    await maybeCompleteDiagnostic(page);
    if (!page.url().includes('/learn/arrays-strings')) {
      await page.goto('/learn/arrays-strings');
    }
    await page.waitForSelector('[data-testid="back-button"]', { timeout: 5000 });

    await page.click('[data-testid="back-button"]');
    await expect(page).toHaveURL('/learn');
  });

  test('concept picker is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await ensureLearnPage(page);
    await page.waitForSelector('[data-testid^="concept-card-"]', { timeout: 8000 });

    const cards = await page.locator('[data-testid^="concept-card-"]').all();
    expect(cards.length).toBeGreaterThanOrEqual(8);

    for (const card of cards.slice(0, 3)) {
      await expect(card).toBeInViewport();
    }
  });
});
