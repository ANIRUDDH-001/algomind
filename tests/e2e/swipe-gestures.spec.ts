import { test, expect } from '@playwright/test';

// Common setup for mobile emulation
test.use({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
});

test.describe('Dashboard Swipe Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    // Wait for the swipe container to be visible.
    // The main container in page.tsx uses className "touch-pan-y"
    await page.waitForSelector('.touch-pan-y', { state: 'visible' });
  });

  test('Swipe left switches to next tab', async ({ page }) => {
    // Verify initial tab is overview
    await expect(page).toHaveURL(/.*dashboard(\?tab=overview)?$/);
    
    const container = page.locator('.touch-pan-y');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not visible');

    // Perform a genuine touch swipe left
    const startX = box.x + box.width * 0.8;
    const startY = box.y + box.height / 2;
    const endX = box.x + box.width * 0.2; // swipe left by 60% of width

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 20 });
    await page.mouse.up();

    // Verify it switches to 'knowledge' (next tab after overview)
    await expect(page).toHaveURL(/.*dashboard\?tab=knowledge/);
  });

  test('Swipe right switches to previous tab', async ({ page }) => {
    // First go to knowledge tab
    await page.goto('/dashboard?tab=knowledge');
    await page.waitForSelector('.touch-pan-y', { state: 'visible' });
    
    const container = page.locator('.touch-pan-y');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not visible');

    // Perform a genuine touch swipe right
    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height / 2;
    const endX = box.x + box.width * 0.8; // swipe right by 60% of width

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 20 });
    await page.mouse.up();

    // Verify it switches to 'overview'
    await expect(page).toHaveURL(/.*dashboard\?tab=overview/);
  });

  test('Small swipe does not switch tabs', async ({ page }) => {
    await page.goto('/dashboard?tab=overview');
    await page.waitForSelector('.touch-pan-y', { state: 'visible' });
    
    const container = page.locator('.touch-pan-y');
    const box = await container.boundingBox();
    if (!box) throw new Error('Container not visible');

    // Perform small swipe left (less than 50px threshold)
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX - 20;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, startY, { steps: 5 });
    await page.mouse.up();

    // Should remain on overview
    await expect(page).toHaveURL(/.*dashboard(\?tab=overview)?$/);
  });
});

test.describe('Vaul Swipe Gestures', () => {
  test('Swipe down dismisses the Vaul drawer', async ({ page }) => {
    await page.goto('/test-modal');
    
    // Open the modal
    await page.click('#open-modal');
    
    // Verify it is open
    await expect(page.locator('#modal-status')).toHaveText('Modal is OPEN');
    
    // Vaul drawer is rendered. The handle or the drawer itself can be dragged.
    // In Vaul, the drawer content is typically what is draggable, or we can drag the whole content downwards.
    const drawerContent = page.locator('[vaul-drawer]');
    await drawerContent.waitFor({ state: 'visible' });

    // Ensure the drag handle or top of the drawer is dragged.
    // Vaul detects swipes downwards to close.
    const box = await drawerContent.boundingBox();
    if (!box) throw new Error('Drawer not visible');

    // Drag from the top-center of the drawer downwards.
    const startX = box.x + box.width / 2;
    const startY = box.y + 20; // 20px from top
    const endY = startY + 300; // drag down 300px

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 20 });
    await page.mouse.up();

    // Verify it is closed
    await expect(page.locator('#modal-status')).toHaveText('Modal is CLOSED');
  });
});
