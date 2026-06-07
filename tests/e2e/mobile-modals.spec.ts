import { test, expect } from '@playwright/test';

test.describe('ResponsiveModal on Mobile', () => {
  test.use({
    viewport: { width: 375, height: 667 },
    hasTouch: true,
  });

  test('should dismiss modal on swipe down but not when scrolling vertically', async ({ page }) => {
    // Go to our simple test page that mounts ResponsiveModal directly
    await page.goto('/test-modal');

    // Open the modal
    await page.click('#open-modal');
    
    // Check if modal is open
    await expect(page.locator('#modal-status')).toHaveText('Modal is OPEN', { timeout: 10000 });
    
    // The Vaul drawer wraps our content. Our content has data-vaul-no-drag.
    // Ensure data-vaul-no-drag exists
    const scrollableContent = page.locator('[data-vaul-no-drag]');
    await expect(scrollableContent).toBeVisible();

    const box = await scrollableContent.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    // Try to swipe down inside the scrolling content (startY: box.y + 50, endY: box.y + 300).
    // Because it has data-vaul-no-drag, it should NOT dismiss the modal.
    await page.mouse.move(box.x + box.width / 2, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 300, { steps: 10 });
    await page.mouse.up();
    
    // Modal should still be open
    await page.waitForTimeout(500); // Give it a moment in case it tries to animate close
    await expect(page.locator('#modal-status')).toHaveText('Modal is OPEN');

    // Now, swipe down on the drawer header (the title) to dismiss it.
    // The header doesn't have data-vaul-no-drag.
    const title = page.getByText('Test Modal');
    await expect(title).toBeVisible();
    
    const titleBox = await title.boundingBox();
    expect(titleBox).not.toBeNull();
    if (!titleBox) return;
    
    // Swipe down on header
    await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + 500, { steps: 10 });
    await page.mouse.up();

    // Verify modal is closed
    await expect(page.locator('#modal-status')).toHaveText('Modal is CLOSED', { timeout: 5000 });
  });
});
