import { test, expect, Page } from '@playwright/test';
import { setE2EAuthCookie } from '../e2e/auth-helper';

const VIEWPORTS = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile-landscape', width: 844, height: 390 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'wide', width: 1920, height: 1080 },
];

const PAGES = [
    { name: 'landing', path: '/' },
    { name: 'interview', path: '/interview?problemId=two-sum' },
    { name: 'dashboard', path: '/dashboard' },
    { name: 'settings', path: '/settings' },
    { name: 'practice', path: '/practice' },
    { name: 'admin-admins', path: '/admin/admins', isAdmin: true },
];

// Mocks to ensure pages load without relying on real backend
async function setupPageMocks(page: Page, path: string, isAdmin = false) {
    // 1. Set Auth cookie for protected routes
    if (path !== '/' && !path.startsWith('/interview')) {
        await setE2EAuthCookie(page.context());
        await page.addInitScript((adminMode) => {
            window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                user: { id: 'test-user-id', email: adminMode ? 'admin@algomind.dev' : 'test@example.com' }
            }));
            window.localStorage.setItem('algomind_demo_mode', 'false');
            window.localStorage.setItem('algomind_tour_completed', 'true');
            window.localStorage.setItem('voice_onboarding_seen', 'true');
        }, isAdmin);
    }

    // 2. Mock Admin API
    if (isAdmin) {
        await page.route('**/api/admin/check*', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ isAdmin: true }) })
        );
        await page.route('**/api/admin/admins', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200, contentType: 'application/json',
                    body: JSON.stringify([{ id: '1', email: 'admin@algomind.dev', added_at: new Date().toISOString() }])
                });
            }
            return route.continue();
        });
    }

    // 3. Mock Chat API for Interview
    if (path.startsWith('/interview')) {
        await page.route('**/api/chat', (route) =>
            route.fulfill({ status: 200, contentType: 'text/event-stream', body: 'mock response' })
        );
    }
}

async function assertResponsiveness(page: Page) {
    // Assert: no horizontal scroll (scrollWidth === clientWidth)
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth);
    expect(noHorizontalScroll, 'Page has horizontal scroll').toBe(true);

    // Assert: no element has negative x position
    const hasNegativeX = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (const el of Array.from(elements)) {
            const rect = el.getBoundingClientRect();
            const htmlEl = el as HTMLElement;
            // Ignore hidden elements
            if (rect.width > 0 && rect.height > 0 && htmlEl.offsetParent !== null) {
                if (rect.x < 0) return true;
            }
        }
        return false;
    });
    expect(hasNegativeX, 'Element found with negative X position').toBe(false);

    // Assert: key interactive elements (buttons, tabs) are visible and not clipped
    const keyElementsCount = await page.locator('button, [role="tab"], a').count();
    for (let i = 0; i < Math.min(keyElementsCount, 20); i++) {
        const el = page.locator('button, [role="tab"], a').nth(i);
        if (await el.isVisible()) {
            const box = await el.boundingBox();
            if (box) {
                expect(box.x, `Element clipped on left: ${await el.evaluate(n => n.outerHTML)}`).toBeGreaterThanOrEqual(0);
                const viewportWidth = await page.evaluate(() => window.innerWidth);
                expect(box.x + box.width, `Element clipped on right: ${await el.evaluate(n => n.outerHTML)}`).toBeLessThanOrEqual(viewportWidth);
            }
        }
    }
}

test.describe('Visual Regression & Responsiveness', () => {
    for (const p of PAGES) {
        test.describe(`Page: ${p.name}`, () => {
            for (const vp of VIEWPORTS) {
                test(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
                    await setupPageMocks(page, p.path, p.isAdmin);

                    // Avoid demo mode cookie issues for interview if not protected route mock
                    if (p.path.startsWith('/interview')) {
                        await page.context().addCookies([
                            {
                                name: 'algomind_demo_mode',
                                value: 'true',
                                url: 'http://localhost:3000',
                            },
                        ]);
                    }

                    await page.setViewportSize({ width: vp.width, height: vp.height });

                    // Navigate to page
                    await page.goto(p.path);
                    await page.waitForLoadState('networkidle');
                    // Wait a bit extra for any layout shifts/animations to settle
                    await page.waitForTimeout(1000);

                    await assertResponsiveness(page);

                    // Save screenshot with name: {page}-{viewport}.png
                    const screenshotName = `${p.name}-${vp.name}.png`;
                    await expect(page).toHaveScreenshot(screenshotName, {
                        maxDiffPixels: 200,
                        fullPage: true,
                    });
                });
            }
        });
    }
});
