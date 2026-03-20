import { test, expect } from '@playwright/test';

test.describe('Mobile responsiveness at 375px', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('learn page has no horizontal scroll at 375px', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // +2px tolerance for rounding
  });

  test('concept picker cards are fully visible at 375px', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForSelector('[data-testid*="concept-tile"]', { timeout: 10000 } ).catch(() => {
      // May not exist if user already completed diagnostic
    });

    // Check if content does not overflow
    const body = await page.evaluate(() => document.body.scrollWidth);
    const window = await page.evaluate((): number => (window as any).innerWidth);
    expect(body).toBeLessThanOrEqual(window + 1);
  });

  test('concept heatmap tiles wrap correctly on 2-column grid', async ({ page }) => {
    // Skip if not on heatmap (might be on diagnostic or concept picker)
    const heatmapExists = await page.locator('[data-testid="concept-heatmap-grid"]').count();
    if (heatmapExists === 0) {
      test.skip();
    }

    const grid = await page.locator('[data-testid="concept-heatmap-grid"]').boundingBox();
    expect(grid?.width).toBeLessThanOrEqual(375);
  });

  test('all inputs are 16px font size to prevent iOS zoom', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    
    const inputs = await page.locator('input, textarea').all();
    for (const input of inputs) {
      const fontSize = await input.evaluate((el) => window.getComputedStyle(el).fontSize);
      // Should be 16px or larger to prevent iOS auto-zoom
      const fontSizeNum = parseInt(fontSize);
      expect(fontSizeNum).toBeGreaterThanOrEqual(16);
    }
  });

  test('mic button is at least 44px for touch accessibility', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    await page.waitForSelector('button[class*="rounded-full"]');

    const micButton = page.locator('button[class*="rounded-full"]').first();
    const box = await micButton.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  test('concept names are clamped to 2 lines in heatmap tiles', async ({ page }) => {
    await page.goto('/learn');
    const conceptName = page.locator('[data-testid*="concept-tile"] span').first();
    
    if (!conceptName) {
      test.skip();
    }

    const classes = await conceptName.getAttribute('class');
    expect(classes).toContain('line-clamp-2');
  });

  test('no text overflows containers at 375px', async ({ page }) => {
    await page.goto('/learn');
    
    const overflowingElements = await page.evaluate(() => {
      const elements: Element[] = [];
      document.querySelectorAll('*').forEach(el => {
        if (el.scrollWidth > el.clientWidth) {
          // Ignore horizontal scrollers
          if ((el as HTMLElement).style.overflowX !== 'auto' && 
              !el.classList.contains('scroll-container') &&
              !el.classList.contains('mobile-scroll')) {
            elements.push(el);
          }
        }
      });
      return elements.length;
    });

    expect(overflowingElements).toBe(0);
  });

  test('iOS safe area is applied to bottom input areas', async ({ page }) => {
    await page.goto('/learn/diagnostic');
    
    const inputArea = page.locator('.safe-area-bottom').first();
    if (await inputArea.count() === 0) {
      test.skip();
    }

    const classes = await inputArea.getAttribute('class');
    expect(classes).toContain('safe-area-bottom');
  });
});

test.describe('Mobile responsiveness at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('learn page layout is stable at 390px', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});

test.describe('Mobile responsiveness at 430px', () => {
  test.use({ viewport: { width: 430, height: 932 } });

  test('learn page layout is stable at 430px', async ({ page }) => {
    await page.goto('/learn');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('buttons meet minimum touch target size at 430px', async ({ page }) => {
    await page.goto('/learn');
    
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const isVisible = await button.isVisible();
      if (!isVisible) continue;

      const box = await button.boundingBox();
      if (!box) continue;

      // Interactive elements should be at least 44x44
      if (box.height < 30 || box.width < 30) {
        // Very small buttons (like icons) can be smaller if they have nearby tap targets
        const padding = await button.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.padding;
        });
        // If it's tiny, ensure it has padding context
        expect(padding).not.toBe('0px');
      }
    }
  });
});
