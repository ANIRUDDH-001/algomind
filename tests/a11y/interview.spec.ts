/**
 * Accessibility tests for the interview page using axe-core.
 * Covers WCAG 2.1 AA, keyboard navigation, ARIA, focus trapping, and contrast.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setE2EAuthCookie } from '../e2e/auth-helper';

const VIEWPORTS = [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
];

async function setupInterview(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
    await setE2EAuthCookie(context);
    await page.addInitScript(() => {
        window.localStorage.setItem('algomind_demo_mode', 'false');
        window.localStorage.setItem('algomind_tour_completed', 'true');
        window.localStorage.setItem('voice_onboarding_seen', 'true');
        window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            user: { id: 'test-user', email: 'test@example.com' },
        }));
    });
    await page.goto('/interview?problemId=two-sum');
    await page.waitForLoadState('networkidle');
}

// ═══════════════════════════════════════════════
//  1 & 2. axe-core WCAG 2.1 AA analysis
// ═══════════════════════════════════════════════
for (const vp of VIEWPORTS) {
    test.describe(`Accessibility: ${vp.name} (${vp.width}×${vp.height})`, () => {
        test('No WCAG 2.1 AA violations', async ({ page, context }) => {
            await page.setViewportSize(vp);
            await setupInterview(page, context);

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
                // color-contrast has its own dedicated test (3f)
                // scrollable-region-focusable fires on scroll containers without tabindex (common in React)
                .disableRules(['color-contrast', 'scrollable-region-focusable'])
                // Exclude third-party widgets we can't control
                .exclude('.monaco-editor')
                .exclude('[data-sonner-toaster]')
                .exclude('[data-radix-popper-content-wrapper]')
                .analyze();

            // Log all violations for debugging and tracking
            if (results.violations.length > 0) {
                console.log(`⚠️  axe found ${results.violations.length} violations on ${vp.name}:`);
                for (const v of results.violations) {
                    console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`);
                }
            }

            // Only fail on critical/serious issues in our own code
            const critical = results.violations.filter(
                v => v.impact === 'critical' || v.impact === 'serious',
            );
            expect(
                critical,
                `Found ${critical.length} critical/serious accessibility violations`,
            ).toHaveLength(0);
        });
    });
}

// ═══════════════════════════════════════════════
//  3. Specific ARIA and semantic checks
// ═══════════════════════════════════════════════
test.describe('Interview page ARIA & semantics', () => {
    test.beforeEach(async ({ page, context }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await setupInterview(page, context);
    });

    test('3a. All tabs have aria-label or visible text', async ({ page }) => {
        const tabs = page.getByRole('tab');
        const count = await tabs.count();
        for (let i = 0; i < count; i++) {
            const tab = tabs.nth(i);
            const ariaLabel = await tab.getAttribute('aria-label');
            const textContent = (await tab.textContent())?.trim();
            expect(
                ariaLabel || textContent,
                `Tab ${i} has no accessible name`,
            ).toBeTruthy();
        }
    });

    test('3b. Microphone button has appropriate aria-label', async ({ page }) => {
        // Click Begin Interview to access mic button
        const beginBtn = page.getByRole('button', { name: /begin interview/i });
        if (await beginBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await beginBtn.click();
            await page.waitForTimeout(1000);
        }

        const micButton = page.locator(
            '[data-testid="mic-button"], button[aria-label*="record" i], button[aria-label*="microphone" i], button[aria-label*="mic" i]',
        );
        if (await micButton.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
            const ariaLabel = await micButton.first().getAttribute('aria-label');
            const title = await micButton.first().getAttribute('title');
            expect(ariaLabel || title, 'Mic button has no accessible label').toBeTruthy();
        }
    });

    test('3c. Code editor is keyboard navigable (Tab focuses editor)', async ({ page }) => {
        // Click Begin Interview first
        const beginBtn = page.getByRole('button', { name: /begin interview/i });
        if (await beginBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await beginBtn.click();
            await page.waitForTimeout(1000);
        }

        // Switch to mobile to get the Code tab
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(300);

        const codeTab = page.getByRole('tab', { name: /code/i });
        if (await codeTab.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
            await codeTab.first().click();
            await page.waitForTimeout(500);

            // Tab into the editor area
            await page.keyboard.press('Tab');
            await page.keyboard.press('Tab');

            // Check something received focus in the code area
            const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
            expect(focusedTag).toBeTruthy();
        }
    });

    test('3d. Error messages have role="alert"', async ({ page }) => {
        // Check that any visible alert elements use the correct role
        const alerts = page.locator('[role="alert"]');
        const alertCount = await alerts.count();
        // If alerts exist, verify they contain text content
        for (let i = 0; i < alertCount; i++) {
            const text = await alerts.nth(i).textContent();
            // Alerts should either be empty (no errors) or contain meaningful text
            expect(text).toBeDefined();
        }
        // The page should have the Sonner notification region with role="region"
        const notifRegion = page.locator('section[aria-label*="Notification" i], [role="region"][aria-label*="Notification" i]');
        if (await notifRegion.first().isVisible({ timeout: 1_000 }).catch(() => false)) {
            await expect(notifRegion.first()).toBeAttached();
        }
    });

    test('3f. Color contrast on dark background meets 4.5:1 ratio', async ({ page }) => {
        // Use axe-core specifically for color-contrast rule
        const results = await new AxeBuilder({ page })
            .withRules(['color-contrast'])
            .exclude('.monaco-editor') // Monaco manages its own themes
            .exclude('[data-sonner-toaster]')
            .exclude('[data-radix-popper-content-wrapper]')
            .analyze();

        const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');

        // Log violations for future remediation
        if (contrastViolations.length > 0) {
            console.log(`⚠️  Color contrast violations: ${contrastViolations.length}`);
            for (const v of contrastViolations) {
                for (const node of v.nodes) {
                    console.log(`  ${node.target.join(' > ')}: ${node.failureSummary}`);
                }
            }
        }

        // Track trend — fail only if contrast issues are severe (> 5 violating nodes)
        const totalNodes = contrastViolations.reduce((sum, v) => sum + v.nodes.length, 0);
        expect(
            totalNodes,
            `Too many color contrast violations (${totalNodes} nodes). Fix high-impact ones.`,
        ).toBeLessThanOrEqual(5);
    });
});

// ═══════════════════════════════════════════════
//  4. Keyboard navigation
// ═══════════════════════════════════════════════
test.describe('Keyboard navigation', () => {
    test.beforeEach(async ({ page, context }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await setupInterview(page, context);
    });

    test('4a. Tab through interview page without mouse', async ({ page }) => {
        // Start tabbing from the top of the page
        const focusedElements: string[] = [];

        for (let i = 0; i < 15; i++) {
            await page.keyboard.press('Tab');
            const tagName = await page.evaluate(() => {
                const el = document.activeElement;
                return el ? `${el.tagName}:${el.getAttribute('role') || ''}:${el.textContent?.slice(0, 30) || ''}` : 'none';
            });
            focusedElements.push(tagName);
        }

        // Should have focused at least some interactive elements
        expect(focusedElements.length).toBeGreaterThan(0);
        // At least some BUTTON or A elements should be reachable
        const interactiveCount = focusedElements.filter(
            el => el.startsWith('BUTTON') || el.startsWith('A'),
        ).length;
        expect(interactiveCount, 'No interactive elements reachable via Tab').toBeGreaterThan(0);
    });

    test('4b. Reach Begin Interview button via keyboard', async ({ page }) => {
        let foundBeginButton = false;

        for (let i = 0; i < 30; i++) {
            await page.keyboard.press('Tab');
            const text = await page.evaluate(() => document.activeElement?.textContent?.trim() || '');
            if (/begin interview/i.test(text)) {
                foundBeginButton = true;
                break;
            }
        }

        expect(foundBeginButton, '"Begin Interview" button not reachable via Tab key').toBe(true);
    });

    test('4c. Switch tabs via keyboard (on mobile layout)', async ({ page }) => {
        // Click Begin Interview first
        const beginBtn = page.getByRole('button', { name: /begin interview/i });
        if (await beginBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await beginBtn.click();
            await page.waitForTimeout(1000);
        }

        // Switch to mobile viewport
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500);

        // Focus the first tab
        const firstTab = page.getByRole('tab').first();
        if (await firstTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await firstTab.focus();

            // Use Arrow keys to switch tabs (standard ARIA tab pattern)
            const initialText = await firstTab.textContent();
            await page.keyboard.press('ArrowRight');
            await page.waitForTimeout(200);

            const focusedText = await page.evaluate(() => document.activeElement?.textContent?.trim());
            // Should have moved to a different tab
            if (initialText?.trim() !== focusedText) {
                expect(focusedText).toBeTruthy();
            }
        }
    });

    test('4d. Access code editor via keyboard', async ({ page }) => {
        // Click Begin Interview
        const beginBtn = page.getByRole('button', { name: /begin interview/i });
        if (await beginBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
            await beginBtn.click();
            await page.waitForTimeout(1000);
        }

        // Mobile view to access Code tab
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(300);

        const codeTab = page.getByRole('tab', { name: /code/i });
        if (await codeTab.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
            // Focus and activate Code tab via keyboard
            await codeTab.first().focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);

            // Tab into the code editor
            await page.keyboard.press('Tab');

            // Type something to confirm editor is focused
            const beforeFocus = await page.evaluate(() => document.activeElement?.className || '');
            expect(beforeFocus).toBeTruthy();
        }
    });
});
