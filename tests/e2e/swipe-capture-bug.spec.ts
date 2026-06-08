import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 375, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.describe('Swipe Navigation Capture Bug', () => {
  test('Inner buttons can be clicked', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForSelector('.touch-pan-y', { state: 'visible' });

    // Assuming there are buttons in the dashboard. Let's find any button inside the container.
    // Or we can just evaluate a click on the container and see what the target is.
    
    // Instead of relying on existing buttons, let's inject a button into the container.
    await page.evaluate(() => {
      const container = document.querySelector('.touch-pan-y');
      if (container) {
        const btn = document.createElement('button');
        btn.id = 'test-btn';
        btn.innerText = 'Click Me';
        btn.onclick = () => { (window as any).__btnClicked = true; };
        container.appendChild(btn);
      }
    });

    const box = await page.locator('#test-btn').boundingBox();
    if (!box) throw new Error('Button not visible');

    // Perform a genuine tap using pointer events
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();

    // Check if button was clicked
    const wasClicked = await page.evaluate(() => !!(window as any).__btnClicked);
    expect(wasClicked).toBe(true);
  });
});
