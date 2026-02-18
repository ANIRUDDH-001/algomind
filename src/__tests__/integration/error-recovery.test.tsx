import { test, expect } from '@playwright/test';
import {
    setupInterviewPage,
    waitForInterviewReady,
    mockRateLimit,
    mockNetworkFailureWithRetry
} from '../../test-utils/playwright-helpers';
import { TEST_IDS } from '../../test-utils/test-ids';

test.describe('Error Recovery & Resilience', () => {
    // Note: We do NOT use beforeEach for setupInterviewPage because
    // each test needs precise control over WHEN navigation happens
    // relative to mock setup.

    // Global console capture for debugging
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log(`PAGE LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`PAGE ERROR: ${err.message}`));
    });

    test('VAD Initialization Failure (Fallback to Manual)', async ({ page }) => {
        // 1. Initial Setup
        await page.context().grantPermissions(['microphone']);

        // 2. Add Init Script (Runs on every load)
        await page.addInitScript(() => {
            console.log('PAGE LOG: Init script running');
            (window as any).__PLAYWRIGHT_TEST__ = true;

            // Mock VAD
            (window as any).mockMicVAD = {
                new: async (options: any) => ({
                    start: async () => { },
                    pause: async () => { },
                    destroy: async () => { },
                }),
            };

            // Mock generic success for Chat API to avoid "Processing" state hang
            (window as any).__MOCK_CHAT_RESPONSE__ = 'Test Response';

            // Mock generic successful audio setup if not already mocked
            if (!navigator.mediaDevices) {
                (navigator as any).mediaDevices = {};
            }

            // Mock getUserMedia to return a fake stream
            if (!navigator.mediaDevices.getUserMedia) {
                navigator.mediaDevices.getUserMedia = async () => {
                    const ctx = new AudioContext();
                    return ctx.createMediaStreamDestination().stream;
                };
            }

            // Enable VAD feature flag
            localStorage.setItem('algomind_feature_flags', JSON.stringify({
                ENABLE_VAD_INTERRUPTIONS: true
            }));

            // Force VAD Failure hook
            (window as any).__FORCE_VAD_FAILURE__ = true;
            console.log('PAGE LOG: Flags set in init script');
        });

        // Mock API route for Intro
        await page.route(/.*\/api\/chat.*/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ response: 'Intro done' })
            });
        });

        // 3. Navigate
        await page.goto('/interview');
        await page.waitForLoadState('networkidle');

        // 4. Wait for Begin button
        const beginBtn = page.getByRole('button', { name: /begin interview/i });
        await expect(beginBtn).toBeVisible({ timeout: 10000 });
        await beginBtn.click();

        // 5. Verify fallback UI appeared
        await expect(page.getByTestId(TEST_IDS.VAD_ERROR_BANNER)).toBeVisible({ timeout: 10000 });

        // 6. Verify mic button still available
        await expect(page.getByTestId(TEST_IDS.MIC_BUTTON).first()).toBeEnabled({ timeout: 5000 });
    });

    test('Groq Rate Limit (Fallback Handling)', async ({ page }) => {
        // 1. Mock Intro API first
        await page.route(/.*\/api\/chat.*/, async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ response: 'Intro done' })
            });
        });

        // 2. Navigate & Setup
        await setupInterviewPage(page);
        await waitForInterviewReady(page);

        // 3. Set up rate limit mock (Overrides previous route)
        const { getCallCount } = await mockRateLimit(page);

        // 4. Trigger an AI interaction via our test hook
        await page.evaluate(() => {
            console.log('Test: Triggering AI call via hook');
            if ((window as any).__TRIGGER_AI_CALL__) {
                (window as any).__TRIGGER_AI_CALL__('explain binary search');
            } else {
                throw new Error('Test hook __TRIGGER_AI_CALL__ not found');
            }
        });

        // 5. Verify fallback/retry happened gracefully
        // We expect the success message from the mock after the rate limit was handled
        await expect(page.getByText(/success after retry/i)).toBeVisible({ timeout: 20000 });

        // 6. Confirm rate limit was actually triggered at least once
        expect(getCallCount()).toBeGreaterThan(0);
    });

    test('Network Failure (Retry Logic)', async ({ page }) => {
        // 1. Navigate & Setup
        await setupInterviewPage(page);
        await waitForInterviewReady(page);

        // 2. Set up network failure mock AFTER page is loaded
        const { getCallCount } = await mockNetworkFailureWithRetry(page, 1);

        // 3. Trigger AI call via hook
        await page.evaluate(() => {
            console.log('Test: Triggering AI call via hook (Network Failure)');
            if ((window as any).__TRIGGER_AI_CALL__) {
                (window as any).__TRIGGER_AI_CALL__('hello network test');
            } else {
                throw new Error('Test hook __TRIGGER_AI_CALL__ not found');
            }
        });

        // 4. Verify eventual success
        await expect(page.getByText(/success after retry/i)).toBeVisible({ timeout: 20000 });

        // 5. Verify retry happened (call count should be > 1)
        expect(getCallCount()).toBeGreaterThan(1);
    });
});
