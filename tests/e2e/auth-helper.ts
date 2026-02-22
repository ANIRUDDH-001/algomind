import { BrowserContext } from '@playwright/test';

/**
 * Injects a cookie to bypass the Next.js middleware (proxy.ts) auth check.
 * This allows the Playwright test to reach protected routes and rely on 
 * client-side API mocking.
 */
export async function setE2EAuthCookie(context: BrowserContext, baseURL: string = 'http://localhost:3000') {
    await context.addCookies([
        {
            name: 'playwright-e2e',
            value: 'true',
            url: baseURL,
        },
    ]);
}
