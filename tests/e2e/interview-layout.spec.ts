import { test, expect } from '@playwright/test';
import { setE2EAuthCookie } from './auth-helper';

test.describe('BUG-V7-11 Regression Prevention: Interview Layout', () => {
    test('Desktop layout (1440x900) panels resize without overflow', async ({ page }) => {
        // Test on desktop viewport (1440x900)
        await page.setViewportSize({ width: 1440, height: 900 });

        // Build prerequisites - bypass auth checks to load /interview easily
        await setE2EAuthCookie(page.context());
        await page.addInitScript(() => {
            window.localStorage.setItem('algomind_demo_mode', 'false');
            window.localStorage.setItem('algomind_tour_completed', 'true');
            window.localStorage.setItem('voice_onboarding_seen', 'true');
            // Provide a mock session to pass the requiresUser boundary without hitting DB
            window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
                access_token: 'mock-token',
                refresh_token: 'mock-refresh',
                user: { id: 'test-user', email: 'test@example.com' }
            }));
        });

        // 1. Navigate to /interview
        await page.goto('/interview?problemId=two-sum');
        await page.waitForLoadState('networkidle');

        // 2. Start the interview to render the panels
        const beginButton = page.getByRole('button', { name: /begin interview/i });
        await expect(beginButton).toBeVisible({ timeout: 15_000 });
        await beginButton.click();

        // 3. Wait for InterviewSession to load
        // Look for the ResizablePanelGroup specific to the desktop interview view
        const panelGroup = page.locator('#interview_panels_v2');
        await expect(panelGroup).toBeVisible({ timeout: 15_000 });
        // Let layout computations settle
        await page.waitForTimeout(1000);

        // A reusable helper to assert layout constraints
        async function assertNoOverflow() {
            // 3. Assert: document.body.scrollWidth <= window.innerWidth (no horizontal overflow)
            const hasHorizontalScroll = await page.evaluate(() => {
                return document.documentElement.scrollWidth > document.documentElement.clientWidth;
            });
            expect(hasHorizontalScroll, 'Body has horizontal scroll/overflow').toBe(false);

            // 4. Assert: ResizablePanelGroup container width === viewport width (or fits inside container)
            const groupBox = await panelGroup.boundingBox();
            expect(groupBox).not.toBeNull();
            if (groupBox) {
                const viewportWidth = await page.evaluate(() => window.innerWidth);
                expect(groupBox.width, `Panel group width (${groupBox.width}) exceeds viewport (${viewportWidth})`).toBeLessThanOrEqual(viewportWidth);
            }

            // 5. Assert: all three panels are visible with width > 0
            const panels = panelGroup.locator('[data-panel]');
            // Wait for panels to be attached
            await expect(panels).toHaveCount(3);
            const panelCount = await panels.count();
            expect(panelCount).toBe(3);

            for (let i = 0; i < panelCount; i++) {
                const pBox = await panels.nth(i).boundingBox();
                expect(pBox).not.toBeNull();
                if (pBox) {
                    expect(pBox.width, `Panel ${i} width is not > 0`).toBeGreaterThan(0);
                }
            }

            // 6. Assert: right edge of rightmost panel does not exceed viewport
            const lastPanelBox = await panels.last().boundingBox();
            if (lastPanelBox) {
                const viewportWidth = await page.evaluate(() => window.innerWidth);
                const rightEdge = lastPanelBox.x + lastPanelBox.width;
                // Add a 2px tolerance for fractional pixel bounding box values
                expect(rightEdge).toBeLessThanOrEqual(viewportWidth + 2);
            }
        }

        // Initial check without edits
        await assertNoOverflow();

        // 7 & 8. Test panel handles
        const handles = panelGroup.locator('.bg-slate-800\\/50');
        // Wait for handles
        await expect(handles).toHaveCount(2);

        // 7. Drag left handle to resize problem panel to minSize
        const handle1Box = await handles.nth(0).boundingBox();
        if (handle1Box) {
            await page.mouse.move(handle1Box.x + handle1Box.width / 2, handle1Box.y + handle1Box.height / 2);
            await page.mouse.down();
            // Drag left by a very large amount to reach minSize
            await page.mouse.move(handle1Box.x - 800, handle1Box.y + handle1Box.height / 2, { steps: 10 });
            await page.mouse.up();
        }

        await page.waitForTimeout(500);

        // 8. Drag right handle to resize code panel to minSize
        // The right handle will be right next to the interaction panel/code panel.
        // Dragging it far right minimizes the rightmost panel (history).
        const handle2Box = await handles.nth(1).boundingBox();
        if (handle2Box) {
            await page.mouse.move(handle2Box.x + handle2Box.width / 2, handle2Box.y + handle2Box.height / 2);
            await page.mouse.down();
            // Drag right by a very large amount to reach minSize for the right panel
            await page.mouse.move(handle2Box.x + 800, handle2Box.y + handle2Box.height / 2, { steps: 10 });
            await page.mouse.up();
        }

        await page.waitForTimeout(500);

        // 9. Assert: no overflow at min sizes either
        await assertNoOverflow();
    });
});
