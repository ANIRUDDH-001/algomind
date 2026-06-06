/**
 * E2E: Admin panel functionality.
 *
 * Prerequisites: Admin user seeded in DB (SQL-01 bootstrap).
 * These tests mock the admin API at the network level to avoid
 * needing a real seeded DB in CI.
 */
import { test, expect, Page } from '@playwright/test';
import { setE2EAuthCookie } from './auth-helper';

const runAdminE2E = process.env.E2E_FULL_STACK === 'true';

// ── Helpers ──

/** Mock the admin check to return true (admin user) */
async function setupAdminSession(page: Page) {
    // await setE2EAuthCookie(page.context());

    // Inject auth token to localStorage so client-side useAuth doesn't panic
    await page.addInitScript(() => {
        window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            user: { id: 'test-user-id', email: 'admin@algomind.dev' }
        }));
        // Explicitly disable demo mode for admin/settings tests
        window.localStorage.setItem('algomind_demo_mode', 'false');
        // Prevent tour from showing
        window.localStorage.setItem('algomind_tour_completed', 'true');
        window.localStorage.setItem('voice_onboarding_seen', 'true');
    });

    // Mock the owner status
    await page.route('**/api/user/owner-status', async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ isOwner: true }),
            });
        }
        return route.continue();
    });

    // Mock the admin admins API to return a seed admin
    await page.route('**/api/admin/admins', async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: '1',
                        email: 'admin@algomind.dev',
                        added_at: new Date().toISOString(),
                    },
                ]),
            });
        }
        return route.continue();
    });

    // Mock owner users API for employers search/promote/demote contract
    await page.route('**/api/owner/users*', (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ users: [] }),
            });
        }
        if (route.request().method() === 'PATCH') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true }),
            });
        }
        return route.continue();
    });
}

/** Setup session for non-admin user */
async function setupNonAdminSession(page: Page) {
    await setE2EAuthCookie(page.context());
    
    // Inject auth token for non-admin
    await page.addInitScript(() => {
        window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
            access_token: 'mock-token-user',
            refresh_token: 'mock-refresh-user',
            user: { id: 'test-user-id-normal', email: 'user@algomind.dev' }
        }));
    });
}

// ───────────────────────────────────────────────
//  1. Admin Panel Auth
// ───────────────────────────────────────────────

test.describe('Admin Panel Auth', () => {
    test.skip(!runAdminE2E, 'Set E2E_FULL_STACK=true to run admin E2E tests that depend on full app state.');

    test('non-admin is redirected or sees 403', async ({ page }) => {
        await setupNonAdminSession(page);
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Should see one of: redirect to dashboard, 403 error, or redirect to login
        const url = page.url();
        const body = await page.textContent('body');
        const isRedirected =
            url.includes('/dashboard') || url.includes('/login');
        const shows403 =
            body?.includes('Forbidden') ||
            body?.includes('not authorized') ||
            body?.includes('Failed to load admins');

        expect(isRedirected || shows403).toBe(true);
    });

    test('admin sees admins list', async ({ page }) => {
        await setupAdminSession(page);
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // "Admin Users" heading should be visible
        await expect(
            page.locator('h1:has-text("Admin Users")'),
        ).toBeVisible({ timeout: 10_000 });

        // Seeded admin email should appear
        await expect(
            page.locator('text=admin@algomind.dev'),
        ).toBeVisible();
    });
});

// ───────────────────────────────────────────────
//  2. Admin Models Page
// ───────────────────────────────────────────────

test.describe('Admin Models Page', () => {
    test.skip(!runAdminE2E, 'Set E2E_FULL_STACK=true to run admin E2E tests that depend on full app state.');

    test('model registry table loads with at least 1 model', async ({
        page,
    }) => {
        await setupAdminSession(page);

        // Mock the models API
        await page.route('**/api/admin/models*', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        modelId: 'llama-3.3-70b-versatile',
                        provider: 'groq',
                        tier: 1,
                        rpm: 30,
                        tpm: 15000,
                        rpd: 1000,
                        contextWindow: 32768,
                        isActive: true,
                        isVerified: true,
                        isPreview: false,
                        deprecatedAt: null,
                        lastVerified: new Date().toISOString(),
                        notes: null,
                        rateLimitHits24h: 0,
                        lastRateLimitHit: null,
                        status: 'active',
                    },
                ]),
            }),
        );

        await page.goto('/owner?tab=models');
        await page.waitForLoadState('networkidle');

        // Page should NOT show a 500 error
        const body = await page.textContent('body');
        expect(body).not.toContain('Internal Server Error');
        expect(body).not.toContain('Application error');

        // At least 1 model should be shown
        await expect(
            page.locator('text=llama-3.3-70b-versatile'),
        ).toBeVisible({ timeout: 10_000 });
    });
});

// ───────────────────────────────────────────────
//  3. Add/Remove Admin
// ───────────────────────────────────────────────

test.describe('Add/Remove Admin', () => {
    test.skip(!runAdminE2E, 'Set E2E_FULL_STACK=true to run admin E2E tests that depend on full app state.');

    test('add admin → appears in list → remove → disappears', async ({
        page,
    }) => {
        const admins = [
            {
                id: '1',
                email: 'admin@algomind.dev',
                added_at: new Date().toISOString(),
            },
        ];

        // Dynamic mock that tracks state
        await page.route('**/api/admin/admins', async (route) => {
            const method = route.request().method();

            if (method === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([...admins]),
                });
            }

            if (method === 'POST') {
                const body = JSON.parse(route.request().postData() || '{}');
                admins.push({
                    id: String(admins.length + 1),
                    email: body.email,
                    added_at: new Date().toISOString(),
                });
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            }

            if (method === 'DELETE') {
                const body = JSON.parse(route.request().postData() || '{}');
                const idx = admins.findIndex((a) => a.email === body.email);
                if (admins.length <= 1) {
                    return route.fulfill({
                        status: 400,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: 'Cannot remove the last admin',
                        }),
                    });
                }
                if (idx >= 0) admins.splice(idx, 1);
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            }

            return route.continue();
        });

        await page.route('**/api/owner/users*', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ users: [] }),
                });
            }
            if (route.request().method() === 'PATCH') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            }
            return route.continue();
        });

        await page.goto('/admin');
        await page.waitForLoadState('networkidle');

        // Step 2: Add a new test email
        const emailInput = page.locator(
            'input[type="email"][placeholder*="example.com"]',
        );
        await emailInput.fill('test-admin@example.com');
        await page.getByRole('button', { name: /add admin/i }).click();

        // New admin should appear after re-fetch
        await expect(
            page.locator('text=test-admin@example.com'),
        ).toBeVisible({ timeout: 5_000 });

        // Step 3: Remove that email
        // Find the remove button next to test-admin
        const testAdminRow = page
            .locator('[data-slot="card"]')
            .filter({ hasText: 'test-admin@example.com' });
        const removeBtn = testAdminRow
            .getByRole('button', { name: /remove/i })
            .or(testAdminRow.locator('button:has(svg)'));
        await removeBtn.first().click();

        // Confirm deletion
        const confirmBtn = page.getByRole('button', {
            name: /yes, remove/i,
        });
        if (await confirmBtn.isVisible()) {
            await confirmBtn.click();
        }

        // Should disappear
        await expect(
            page.locator('text=test-admin@example.com'),
        ).not.toBeVisible({ timeout: 5_000 });

        // Step 4: Try to remove the last admin → error
        // Only admin@algomind.dev remains, remove button should be disabled
        const lastAdminRow = page
            .locator('[data-slot="card"]')
            .filter({ hasText: 'admin@algomind.dev' });
        const lastRemoveBtn = lastAdminRow
            .getByRole('button', { name: /remove/i })
            .or(lastAdminRow.locator('button:has(svg)'));

        // Button should be disabled when only 1 admin remains
        if (await lastRemoveBtn.first().isVisible()) {
            await expect(lastRemoveBtn.first()).toBeDisabled();
        }
    });
});
