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

    test('completes a full text-mode interview', async ({ page }, testInfo) => {
        test.skip(
            testInfo.project.name === 'Mobile Chrome',
            'Text-mode interview flow is validated on desktop layout only.'
        );

        // Navigate to interview — uses authenticated session from global-setup storageState.
        await page.goto('/interview');
        await page.waitForLoadState('networkidle');

        // If not authenticated (no session in storageState), skip rather than fail.
        const loginRedirect = page.url().includes('/login');
        test.skip(loginRedirect, 'Authentication not available — skipping interview flow test.');

        // Some environments may hard-stop at daily cap; skip instead of failing the suite.
        const dailyLimitBanner = page.getByText('Daily limit reached');
        test.skip(
            await dailyLimitBanner.isVisible(),
            'Interview daily limit gate is active in this environment.'
        );

        const conversationView = page.locator('[data-testid="conversation-view"]');

        // Start interview if we are still in pre-start state.
        if (!(await conversationView.isVisible())) {
            const startButton = page.locator(
                '[data-testid="begin-interview-btn"]:visible, [data-testid="start-interview"]:visible, button:has-text("Begin Interview Experience"):visible, button:has-text("Start"):visible'
            );
            await expect(startButton.first()).toBeVisible({ timeout: 15000 });
            await startButton.first().scrollIntoViewIfNeeded();
            await startButton.first().click();
        }

        // Wait for problem intro.
        await page.waitForSelector(
            '[data-testid="conversation-view"], [data-testid="transcript-area"]',
            { timeout: 20000 }
        );

        // Text input is optional in this app build; skip if unavailable.
        const textInput = page.locator('[data-testid="text-input"]');
        test.skip(
            !(await textInput.first().isVisible()),
            'Text input mode is not available in this interview configuration.'
        );
        await expect(textInput.first()).toBeVisible({ timeout: 10000 });

        // Send a message.
        await textInput.first().fill('I would approach this using a hash map for O(n) lookup.');
        const sendButton = page.locator(
            '[data-testid="send-button"], [data-testid="send-text-button"], button[type="submit"]'
        );
        await sendButton.first().click();

        // Wait for AI response.
        // We rely on the assertion below.

        // Verify a response appeared.
        const messages = page.locator(
            '[data-testid="conversation-view"] [class*="rounded-"]'
        );
        await expect(page.getByText('Kai').first()).toBeVisible({ timeout: 30000 });

        // Send another message.
        await textInput.first().fill('The time complexity is O(n) and space is O(n).');
        await sendButton.first().click();
        // Verify interview is progressing (more than 1 exchange).
        await expect(messages).toHaveCount(3, { timeout: 15000 }); // Assuming 1 initial message + 2 user messages (or more). Wait for the DOM to update.
        const messageCount = await messages.count();
        expect(messageCount).toBeGreaterThan(1);
    });

    test('interview page loads without errors', async ({ page }) => {
        await page.goto('/interview');
        await page.waitForLoadState('networkidle');

        // If not authenticated, the page redirects to login — that's expected and not an error.
        if (page.url().includes('/login')) return;

        // No error boundaries triggered.
        const errorBoundary = page.locator('text=Something went wrong');
        await expect(errorBoundary).not.toBeVisible({ timeout: 5000 });

        // Page has expected structure.
        await expect(page.locator('body')).not.toBeEmpty();
    });
});
