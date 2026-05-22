import { expect, test } from '@playwright/test';
import { signIn } from '../helpers/auth';

test.describe('Dashboard scrolling', () => {
  test.skip(
    !process.env.TEST_USER_EMAIL,
    'TEST_USER_EMAIL is required for authenticated dashboard scroll tests'
  );

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });

    const authenticated = await signIn(page);
    if (!authenticated) {
      test.skip();
      return;
    }

    await page.waitForLoadState('networkidle');
  });

  test('header stats lane overflows and scrolls on mobile', async ({ page }) => {
    const statsRegion = page.getByRole('region', { name: 'Dashboard statistics scroll area' });
    await expect(statsRegion).toBeVisible();

    const metrics = await statsRegion.evaluate((element: HTMLElement) => ({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);

    await statsRegion.evaluate((element: HTMLElement) => {
      element.scrollBy({ left: 120, behavior: 'auto' });
    });

    const afterScroll = await statsRegion.evaluate((element: HTMLElement) => ({
      scrollLeft: element.scrollLeft,
    }));

    expect(afterScroll.scrollLeft).toBeGreaterThan(metrics.scrollLeft);
  });

  test('dashboard nav tabs overflow on mobile', async ({ page }) => {
    const tabsRegion = page.getByRole('region', { name: 'Dashboard navigation tabs' });
    await expect(tabsRegion).toBeVisible();

    const metrics = await tabsRegion.evaluate((element: HTMLElement) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
  });

  test('session timeline chevrons move the lane', async ({ page }) => {
    const timelineRegion = page.getByRole('region', { name: 'Session timeline' });
    await expect(timelineRegion).toBeVisible();

    const metrics = await timelineRegion.evaluate((element: HTMLElement) => ({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    test.skip(metrics.scrollWidth <= metrics.clientWidth + 8, 'Session timeline does not overflow in this fixture');

    const rightButton = page.getByRole('button', { name: 'Scroll timeline right' });
    await expect(rightButton).toBeVisible();

    await rightButton.click();

    await expect(async () => {
      const afterScroll = await timelineRegion.evaluate((element: HTMLElement) => ({
        scrollLeft: element.scrollLeft,
      }));
      expect(afterScroll.scrollLeft).toBeGreaterThan(metrics.scrollLeft);
    }).toPass();
  });

  test('session timeline starts near the latest sessions', async ({ page }) => {
    const timelineRegion = page.getByRole('region', { name: 'Session timeline' });
    await expect(timelineRegion).toBeVisible();

    const metrics = await timelineRegion.evaluate((element: HTMLElement) => ({
      scrollLeft: element.scrollLeft,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

    test.skip(metrics.scrollWidth <= metrics.clientWidth + 8, 'Session timeline does not overflow in this fixture');

    expect(metrics.scrollLeft).toBeGreaterThan(0);
  });
});
