import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function tryCredentialLogin(baseUrl: string): Promise<void> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const candidateLoginRoutes = ['/auth/login', '/login'];

  for (const route of candidateLoginRoutes) {
    await page.goto(`${baseUrl}${route}`);

    const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="email"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"], [data-testid="password"]');

    if (await emailInput.first().isVisible().catch(() => false) && await passwordInput.first().isVisible().catch(() => false)) {
      await emailInput.first().fill(email);
      await passwordInput.first().fill(password);

      const submit = page.locator('[type="submit"], [data-testid="login-btn"]');
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
