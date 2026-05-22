/**
 * E2E: LeetCode integration in Settings page.
 *
 * Tests the connect flow, error state, and persistence of username.
 */
import { test, expect } from '@playwright/test';
import { setE2EAuthCookie } from './auth-helper';

const runSettingsE2E = process.env.E2E_FULL_STACK === 'true';

// ───────────────────────────────────────────────
//  1. Connect LeetCode Username
// ───────────────────────────────────────────────

test.describe('LeetCode Settings', () => {
    test.skip(!runSettingsE2E, 'Set E2E_FULL_STACK=true to run settings E2E tests that depend on full app state.');

    test.beforeEach(async ({ context, page }) => {
        await setE2EAuthCookie(context);
        await page.addInitScript(() => {
            window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                user: { id: 'test-user-id', email: 'test@example.com' }
            }));
            window.localStorage.setItem('algomind_demo_mode', 'false');
            window.localStorage.setItem('algomind_tour_completed', 'true');
            window.localStorage.setItem('voice_onboarding_seen', 'true');
        });
    });

    test('connect username → success → persists after reload', async ({
        page,
    }) => {
        let connectedUsername: string | null = null;

        // Mock the LeetCode status API to reflect current state
        await page.route('**/api/leetcode/status', (route) => {
            if (connectedUsername) {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        connected: true,
                        username: connectedUsername,
                        totalSolved: 150,
                        easySolved: 80,
                        mediumSolved: 55,
                        hardSolved: 15,
                        ranking: 120000,
                        fetchStatus: 'success',
                        lastFetchedAt: new Date().toISOString(),
                    }),
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ connected: false }),
            });
        });

        // Mock the connect API
        await page.route('**/api/leetcode/connect', async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            connectedUsername = body.username;
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'Connected! Syncing your profile now...',
                }),
            });
        });

        // Mock auth to simulate authenticated user
        await page.route('**/auth/v1/user', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-user-id',
                    email: 'test@example.com',
                }),
            }),
        );

        // Step 2: Navigate to settings
        await page.goto('/settings');
        await page.waitForLoadState('networkidle');

        // Step 3: Find LeetCode username input
        const usernameInput = page.locator(
            'input[placeholder*="leetcode-username"]',
        );

        // If the input isn't immediately visible (may need to scroll or settings may load)
        try {
            await usernameInput.waitFor({ state: 'visible', timeout: 5_000 });
        } catch {}
        if (!(await usernameInput.isVisible())) {
            // Settings page may redirect to login for unauthenticated users
            const body = await page.textContent('body');
            if (
                body?.includes('Sign in') ||
                body?.includes('Log in') ||
                page.url().includes('/login')
            ) {
                test.skip(true, 'Skipped: requires real auth session');
                return;
            }
        }

        // Step 4: Enter a valid username
        await usernameInput.fill('testuser');

        // Step 5: Click Connect
        const connectBtn = page.getByRole('button', { name: /connect/i });
        await connectBtn.click();

        // Step 6: Assert success — no "Database error" banner, username persists
        const body = await page.textContent('body');
        expect(body).not.toContain('Database error');

        // The connected state should now show the username
        await expect(page.locator('text=testuser')).toBeVisible({
            timeout: 5_000,
        });

        // Step 7: Reload page → username persists (from mocked status API)
        await page.reload();
        await page.waitForLoadState('networkidle');
        await expect(page.locator('text=testuser')).toBeVisible({
            timeout: 5_000,
        });
    });
});

// ───────────────────────────────────────────────
//  2. Error State
// ───────────────────────────────────────────────

test.describe('LeetCode Error State', () => {
    test.skip(!runSettingsE2E, 'Set E2E_FULL_STACK=true to run settings E2E tests that depend on full app state.');

    test.beforeEach(async ({ context, page }) => {
        await setE2EAuthCookie(context);
        await page.addInitScript(() => {
            window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                user: { id: 'test-user-id', email: 'test@example.com' }
            }));
            window.localStorage.setItem('algomind_demo_mode', 'false');
            window.localStorage.setItem('algomind_tour_completed', 'true');
            window.localStorage.setItem('voice_onboarding_seen', 'true');
        });
    });

    test('network error on connect shows error, no crash', async ({
        page,
    }) => {
        // Mock status as not connected
        await page.route('**/api/leetcode/status', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ connected: false }),
            }),
        );

        // Mock connect to fail with network error
        await page.route('**/api/leetcode/connect', (route) =>
            route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Database error' }),
            }),
        );

        // Mock auth
        await page.route('**/auth/v1/user', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'test-user-id',
                    email: 'test@example.com',
                }),
            }),
        );

        await page.goto('/settings');
        await page.waitForLoadState('networkidle');

        const usernameInput = page.locator(
            'input[placeholder*="leetcode-username"]',
        );

        try {
            await usernameInput.waitFor({ state: 'visible', timeout: 5_000 });
        } catch {}
        if (!(await usernameInput.isVisible())) {
            if (page.url().includes('/login')) {
                test.skip(true, 'Skipped: requires real auth session');
                return;
            }
        }

        // Type username and hit connect
        await usernameInput.fill('baduser');
        const connectBtn = page.getByRole('button', { name: /connect/i });
        await connectBtn.click();

        // Wait for error to appear (toast or inline)
        await expect(async () => {
            const pageText = await page.textContent('body');
            const hasError = pageText?.includes('Database error') || pageText?.includes('Connection failed') || pageText?.includes('error');
            expect(hasError).toBe(true);
        }).toPass({ timeout: 5_000 });

        // Page should NOT crash — should still be on settings
        expect(page.url()).toContain('/settings');

        // Error message should be shown somewhere (toast or inline)
        const pageText = await page.textContent('body');
        const _hasError =
            pageText?.includes('Database error') ||
            pageText?.includes('Connection failed') ||
            pageText?.includes('error');

        // At minimum, the page didn't crash
        expect(pageText).not.toContain('Application error');
        expect(pageText).not.toContain('Internal Server Error');
    });
});
