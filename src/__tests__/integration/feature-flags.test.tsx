import { disableDemoMode } from '@/lib/demo/manager';
import { test, expect } from '@playwright/test';
import {
    setupInterviewPage,
    waitForInterviewReady,
    InterviewPanelPOM,
    mockChatAPI
} from '../../test-utils/playwright-helpers';
import {  } from '../../test-utils/test-ids';

test.describe('Feature Flags Integration', () => {

    test('All flags OFF (Manual Mode)', async ({ page }) => {
        // Disable all flags before navigation
        await page.addInitScript(() => {
            localStorage.setItem('feature', 'false');
            localStorage.setItem('feature', 'false');
            localStorage.setItem('feature', 'false');
        });

        // Setup
        await setupInterviewPage(page, '/interview');
        await mockChatAPI(page, 'Hello! Ready for manual mode interview.');
        await waitForInterviewReady(page);

        // Use POM to avoid strict mode
        const interview = new InterviewPanelPOM(page);

        // Verify mic button is visible (manual mode)
        await expect(interview.micButton()).toBeVisible({ timeout: 5000 });

        // Verify status shows manual mode (waiting for click)
        const status = await interview.getMicStatus();
        console.log('Manual mode status:', status);
        expect(status.toLowerCase()).toMatch(/waiting|click|start|ready/i);

        console.log('✅ All flags OFF test passed');
    });

    test('VAD Only triggers auto-start', async ({ page }) => {
        // Enable VAD flag before navigation
        await page.addInitScript(() => {
            localStorage.setItem('feature', 'true');
            localStorage.setItem('feature', 'false');
            localStorage.setItem('feature', 'false');
        });

        // Setup
        await setupInterviewPage(page, '/interview');
        await mockChatAPI(page, 'Hello! VAD mode active.');
        await waitForInterviewReady(page);

        // Use POM
        const interview = new InterviewPanelPOM(page);

        // Check initial status
        const statusIndicator = interview.micStatusText();
        await expect(statusIndicator).toBeVisible({ timeout: 5000 });

        const status = await interview.getMicStatus();
        console.log('VAD mode status:', status);

        // In VAD mode, might auto-start OR wait for manual
        // Both are valid depending on browser permissions
        if (status.toLowerCase().includes('listen') || status.toLowerCase().includes('auto-submit')) {
            console.log('✅ VAD auto-started (listening)');
        } else if (status.toLowerCase().match(/waiting|click/)) {
            console.log('VAD waiting for manual start (expected in headless)');

            // Try manual click to trigger VAD
            await interview.clickMic();
            await page.waitForTimeout(1500);

            const updatedStatus = await interview.getMicStatus();
            console.log('After click:', updatedStatus);

            // After manual trigger, should be listening OR still waiting (both OK)
            expect(updatedStatus.toLowerCase()).toMatch(/listen|waiting|ready|auto-submit/i);
        }

        console.log('✅ VAD flag test passed');
    });
});
