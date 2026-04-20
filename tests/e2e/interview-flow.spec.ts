import { test, expect } from '@playwright/test';
import { setE2EAuthCookie } from './auth-helper';

test.describe('Complete interview flow', () => {
    test.beforeEach(async ({ page }) => {
        await setE2EAuthCookie(page.context());
    });

    test('can start an interview', async ({ page }) => {
        await page.goto('/interview');
        await page.click('[data-testid="problem-card"]:first-child');
        await page.waitForURL(/\/interview/);
        expect(await page.locator('[data-testid="interview-session"]').isVisible()).toBe(true);
    });

    test('skill badge fires with real trigger phrase (not "Insight detected +2")', async ({ page }) => {
        // Navigate to interview, send message with clear complexity signal
        await page.goto('/interview?problemId=two-sum');
        await page.click('[data-testid="start-interview"]');
        // Type message with explicit complexity signal
        await page.fill('[data-testid="text-input"]', 'This is O(n) time because we traverse the array once and hash map lookup is O(1)');
        await page.click('[data-testid="send-btn"]');
        // Wait for badge
        const badge = page.locator('[data-testid="skill-badge"]');
        await badge.waitFor({ timeout: 10_000 });
        const badgeText = await badge.textContent();
        // Should NOT contain the fake "Insight detected +2" text
        expect(badgeText).not.toContain('Insight detected +2');
        // Should contain a real phrase
        expect(badgeText!.length).toBeGreaterThan(5);
    });

    test('analysis page shows sub-criteria for expanded skill', async ({ page }) => {
        // Navigate to a completed session's analysis page
        await page.goto('/interview/analysis?sessionId=test-completed-session');
        await page.locator('[data-testid="skill-bar"]:first-child').click();
        const subCriteria = page.locator('[data-testid="sub-criteria-bar"]');
        await subCriteria.first().waitFor();
        expect(await subCriteria.count()).toBeGreaterThan(2);
    });

    test('analysis page shows hire decision for practice mode (not warm-up)', async ({ page }) => {
        await page.goto('/interview/analysis?sessionId=practice-completed-session');
        const hireDecision = page.locator('[data-testid="hire-decision"]');
        await expect(hireDecision).toBeVisible();
    });

    test('warm-up analysis page hides hire decision', async ({ page }) => {
        await page.goto('/interview/analysis?sessionId=warmup-completed-session');
        const hireDecision = page.locator('[data-testid="hire-decision"]');
        await expect(hireDecision).not.toBeVisible();
    });
});
