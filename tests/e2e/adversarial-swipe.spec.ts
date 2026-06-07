import { test, expect, Page } from '@playwright/test';

test.use({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
});

async function setupAdminSession(page: Page) {
    await page.addInitScript(() => {
        window.localStorage.setItem('sb-algomind-auth-token', JSON.stringify({
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            user: { id: 'test-user-id', email: 'admin@algomind.dev' }
        }));
        window.localStorage.setItem('algomind_demo_mode', 'false');
        window.localStorage.setItem('algomind_tour_completed', 'true');
    });

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

    await page.route('**/api/admin/admins', async (route) => {
        if (route.request().method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: '1', email: 'admin1@algomind.dev', added_at: new Date().toISOString() },
                    { id: '2', email: 'admin2@algomind.dev', added_at: new Date().toISOString() },
                    { id: '3', email: 'admin3@algomind.dev', added_at: new Date().toISOString() }
                ]),
            });
        }
        return route.continue();
    });
}

test.describe('Adversarial Swipeable Cards', () => {
    test.beforeEach(async ({ page }) => {
        await setupAdminSession(page);
        await page.goto('/admin');
        await page.waitForSelector('text=Current Admins');
    });

    test('Edge Case 1: Swiping right should not reveal actions', async ({ page }) => {
        const card = page.locator('.relative.overflow-hidden.w-full').filter({ hasText: 'admin2@algomind.dev' }).locator('.cursor-grab');
        const box = await card.boundingBox();
        if (!box) throw new Error('Card not found');

        await page.mouse.move(box.x + 50, box.y + 20);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(box.x + 200, box.y + 20, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(300);

        const style = await card.getAttribute('style');
        const transformMatch = style?.match(/translateX\(([-\d.]+)px\)/);
        const translateX = transformMatch ? parseFloat(transformMatch[1]) : 0;
        
        console.log('Edge Case 1 - Translate X:', translateX);
        expect(translateX).toBeLessThanOrEqual(0);
    });

    test.skip('Edge Case 2: Multiple cards swiped open at once', async ({ page }) => {
        const cards = page.locator('.relative.overflow-hidden.w-full');
        await cards.first().waitFor({ state: 'visible' });
        expect(await cards.count()).toBeGreaterThanOrEqual(2);

        let box1 = await cards.nth(1).locator('.cursor-grab').boundingBox();
        await page.mouse.move(box1!.x + 300, box1!.y + 20);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(box1!.x + 50, box1!.y + 20, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        let box2 = await cards.nth(2).locator('.cursor-grab').boundingBox();
        await page.mouse.move(box2!.x + 300, box2!.y + 20);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(box2!.x + 50, box2!.y + 20, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(300);

        const style1 = await cards.nth(1).locator('.cursor-grab').getAttribute('style');
        const style2 = await cards.nth(2).locator('.cursor-grab').getAttribute('style');
        
        const getTranslateX = (style: string | null) => {
            const match = style?.match(/translateX\(([-\d.]+)px\)/);
            return match ? parseFloat(match[1]) : 0;
        };

        const tx1 = getTranslateX(style1);
        const tx2 = getTranslateX(style2);
        
        console.log('Edge Case 2 - Card 1 tx:', tx1, 'Card 2 tx:', tx2);
        
        expect(tx1 >= -5 || tx2 >= -5).toBe(true);
    });

    test.skip('Edge Case 3: Confirmation dialog visibility', async ({ page }) => {
        const cardContainer = page.locator('.relative.overflow-hidden.w-full').filter({ hasText: 'admin2@algomind.dev' });
        const grabArea = cardContainer.locator('.cursor-grab');
        
        const box = await grabArea.boundingBox();
        await page.mouse.move(box!.x + 300, box!.y + 20);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(box!.x + 50, box!.y + 20, { steps: 10 });
        await page.mouse.up();

        await page.waitForTimeout(500);

        const trashButton = cardContainer.locator('button').first();
        await trashButton.evaluate((node) => (node as HTMLElement).click());

        await page.waitForTimeout(500);

        const yesBtn = cardContainer.locator('button', { hasText: 'Yes' });
        const cancelBtn = cardContainer.locator('button', { hasText: 'Cancel' });

        await expect(yesBtn).toBeVisible();
        await expect(cancelBtn).toBeVisible();

        const yesBox = await yesBtn.boundingBox();
        const grabBox = await grabArea.boundingBox();

        const grabRight = grabBox!.x + grabBox!.width;
        
        console.log('Edge Case 3 - Yes Button x:', yesBox!.x, 'Grab Right:', grabRight);

        expect(yesBox!.x).toBeGreaterThanOrEqual(grabRight);
    });
});
