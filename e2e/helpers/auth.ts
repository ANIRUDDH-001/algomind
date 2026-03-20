import { Page } from '@playwright/test';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL ?? 'test@algomind.dev',
  password: process.env.TEST_USER_PASSWORD ?? 'testpassword123',
};

export async function signIn(page: Page) {
  await page.context().addCookies([
    {
      name: 'playwright-e2e',
      value: 'true',
      url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    },
  ]);

  await page.goto('/login');
  
  // Wait for login form to load
  await page.waitForSelector('[data-testid="email-input"]', { timeout: 10000 });
  
  await page.fill('[data-testid="email-input"]', TEST_USER.email);
  await page.fill('[data-testid="password-input"]', TEST_USER.password);
  await page.click('[data-testid="sign-in-button"]');
  
  // Wait for navigation to dashboard or auth success
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

export async function signOut(page: Page) {
  await page.goto('/settings');
  await page.waitForSelector('[data-testid="sign-out-button"]', { timeout: 5000 });
  await page.click('[data-testid="sign-out-button"]');
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * Get the current authenticated user's ID from the authenticated API.
 */
export async function getCurrentUserId(page: Page): Promise<string> {
  const res = await page.request.get('/api/user/me');
  if (!res.ok()) {
    throw new Error(`Failed to fetch current user: ${res.status()}`);
  }

  const data = await res.json();
  if (!data?.id) {
    throw new Error('Current user id missing in /api/user/me response');
  }

  return data.id;
}
