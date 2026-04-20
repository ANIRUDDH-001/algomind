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
    { name: 'admin-admins', path: '/admin/admins', isAdmin: true },
];

// Mocks to ensure pages load without relying on real backend
async function setupPageMocks(page: Page, path: string, isAdmin = false) {
    // Keep landing/interview visuals deterministic across runs.
    await page.addInitScript(() => {
        window.sessionStorage.setItem('algomind_onboarding_shown_this_session', 'true');
        window.localStorage.setItem('algomind_tour_completed', 'true');
        window.localStorage.setItem('voice_onboarding_seen', 'true');
    });

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

async function dismissInterviewGuestSelector(page: Page) {
    const guestSelector = page.getByTestId('guest-selector-modal');
    if (!(await guestSelector.isVisible({ timeout: 2_000 }).catch(() => false))) {
        return;
    }

    const twoSumProblemBtn = page.getByTestId('problem-card-guest-two-sum');
    if (await twoSumProblemBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await twoSumProblemBtn.click();
    } else {
        const firstProblemBtn = page.locator('[data-testid^="problem-card-"]').first();
        if (await firstProblemBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await firstProblemBtn.click();
        }
    }

    await expect(guestSelector).toBeHidden({ timeout: 10_000 });
}

async function hasRuntimeErrorOverlay(page: Page) {
    const appErrorHeading = page.getByRole('heading', {
        name: /application error: a client-side exception has occurred/i,
    });
    if (await appErrorHeading.isVisible({ timeout: 500 }).catch(() => false)) {
        return true;
    }

    const chunkLoadError = page.getByText('Runtime ChunkLoadError');
    return chunkLoadError.isVisible({ timeout: 500 }).catch(() => false);
}

async function navigateToVisualPage(page: Page, path: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle').catch(() => undefined);

        if (path.startsWith('/interview')) {
            await dismissInterviewGuestSelector(page);
        }

        await page.waitForTimeout(1000);

        if (!(await hasRuntimeErrorOverlay(page))) {
            return;
        }
    }

    throw new Error(`Runtime error overlay persisted for ${path}`);
}

async function assertResponsiveness(page: Page) {
    // Assert: no horizontal scroll (scrollWidth === clientWidth)
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth);
    expect(noHorizontalScroll, 'Page has horizontal scroll').toBe(true);

    // Assert: no element has negative x position
    const hasNegativeX = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const viewportWidth = window.innerWidth;
        for (const el of Array.from(elements)) {
            const rect = el.getBoundingClientRect();
            const htmlEl = el as HTMLElement;
            const computedStyle = window.getComputedStyle(el);
            const opacity = parseFloat(computedStyle.opacity);
            const isTransforming = computedStyle.transform !== 'none' || computedStyle.willChange.includes('transform');
            // Ignore hidden, zero-size, and animating elements
            // Framer Motion sets opacity near 0 during entry animations
            // Elements with opacity < 0.1 are intentionally off-screen (mid-animation)
            if (rect.width > 0 && rect.height > 0 && htmlEl.offsetParent !== null && opacity > 0.1 && !isTransforming) {
                if (rect.right <= 0 || rect.left >= viewportWidth) continue;
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
        const opacity = await el.evaluate(e => parseFloat(window.getComputedStyle(e).opacity)).catch(() => null);
        if (opacity === null) continue;
        if (opacity < 0.1) continue; // Skip elements in entry animation
        const inHorizontalScroller = await el.evaluate((node) => {
            let parent: HTMLElement | null = node.parentElement;
            while (parent) {
                const style = window.getComputedStyle(parent);
                const overflowX = style.overflowX;
                if ((overflowX === 'auto' || overflowX === 'scroll') && parent.scrollWidth > parent.clientWidth) {
                    return true;
                }
                parent = parent.parentElement;
            }
            return false;
        }).catch(() => false);
        if (inHorizontalScroller) continue;
        if (await el.isVisible()) {
            const box = await el.boundingBox().catch(() => null);
            if (box) {
                expect(box.x, `Element clipped on left: ${await el.evaluate(n => n.outerHTML)}`).toBeGreaterThanOrEqual(0);
                const viewportWidth = await page.evaluate(() => window.innerWidth);
                expect(box.x + box.width, `Element clipped on right: ${await el.evaluate(n => n.outerHTML)}`).toBeLessThanOrEqual(viewportWidth);
            }
        }
    }
}

test.describe('Visual Regression & Responsiveness', () => {
    test.describe.configure({ mode: 'serial' });

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

                    await navigateToVisualPage(page, p.path);

                    await assertResponsiveness(page);

                    // Save screenshot with name: {page}-{viewport}.png
                    const screenshotName = `${p.name}-${vp.name}.png`;
                    await expect(page).toHaveScreenshot(screenshotName, {
                        maxDiffPixels: 500,
                        fullPage: true,
                    });
                });
            }
        });
    }
});
