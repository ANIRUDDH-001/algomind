import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function tryCredentialLogin(baseUrl: string): Promise<void> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    console.warn('[e2e/global-setup] TEST_USER_EMAIL or TEST_USER_PASSWORD missing. Using cookie-based fallback auth.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const candidateLoginRoutes = ['/auth/login', '/login'];

  for (const route of candidateLoginRoutes) {
    await page.goto(`${baseUrl}${route}`);

    const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="email-input"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"], [data-testid="password-input"]');

    if (await emailInput.first().isVisible().catch(() => false) && await passwordInput.first().isVisible().catch(() => false)) {
      await emailInput.first().fill(email);
      await passwordInput.first().fill(password);

      const submit = page.locator('[type="submit"], [data-testid="sign-in-button"]');
      await submit.first().click();
      await page.waitForLoadState('networkidle');
      break;
    }
  }

  const authDir = path.join(process.cwd(), '.playwright');
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'auth.json') });
  await browser.close();
}

export default async function globalSetup() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  const authDir = path.join(process.cwd(), '.playwright');
  fs.mkdirSync(authDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.addCookies([
    {
      name: 'playwright-e2e',
      value: 'true',
      url: baseUrl,
    },
  ]);

  await context.storageState({ path: path.join(authDir, 'auth.json') });
  await browser.close();

  await tryCredentialLogin(baseUrl);
}
