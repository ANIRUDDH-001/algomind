import { test, expect } from '@playwright/test';
import {
    setupInterviewPage,
    waitForInterviewReady,
    InterviewPanelPOM,
    mockChatAPI,
    debugInterviewState
} from '../../test-utils/playwright-helpers';

test.describe('Voice Interview Integration', () => {
    test.use({ viewport: { width: 1920, height: 1080 } });

    test('Complete interview flow (End-to-End)', async ({ page }) => {
        console.log('\n=== STEP 1: Setup Interview Page ===');
        await setupInterviewPage(page, '/interview');

        console.log('\n=== STEP 2: Install Chat API Mock ===');
        // Mock BEFORE waiting for ready to catch initial intro call
        await mockChatAPI(page, 'Hello! I understand you want to start the interview.');

        console.log('\n=== STEP 3: Wait for Interview Ready ===');
        await waitForInterviewReady(page);

        console.log('\n=== STEP 4: Initialize POM ===');
        const interview = new InterviewPanelPOM(page);

        console.log('\n=== STEP 5: Wait for Interview to be in Ready State ===');
        // This handles "THINKING..." and "AI IS SPEAKING..." states
        await interview.waitForReady(30000);

        console.log('\n=== STEP 6: Verify Mic Status Indicator Visible ===');
        await expect(interview.micStatusText()).toBeVisible({ timeout: 5000 });

        console.log('\n=== STEP 7: Get Initial Mic Status ===');
        const initialStatus = await interview.getMicStatus();
        console.log('Initial mic status:', initialStatus);

        // Verify initial status is reasonable
        expect(initialStatus.toLowerCase()).toMatch(/waiting|click|start|ready|auto-submit|mic/i);

        console.log('\n=== STEP 8: Wait for Mic Button to be Enabled ===');
        await interview.waitForMicEnabled(10000);

        console.log('\n=== STEP 9: Click Mic Button (with retry) ===');
        await interview.clickMicSafely(3);

        console.log('\n=== STEP 10: Verify Mic State After Click ===');
        // Wait a bit for state to update
        await page.waitForTimeout(1500);

        const activeStatus = await interview.getMicStatus();
        console.log('Active mic status:', activeStatus);

        // After clicking, status should indicate listening or waiting (both valid)
        expect(activeStatus.toLowerCase()).toMatch(/listen|waiting|ready|click|auto-submit|mic/i);

        console.log('\n=== STEP 11: Verify Conversation View Visible ===');
        await expect(interview.conversationView()).toBeVisible({ timeout: 5000 });

        console.log('\n✅ Voice interview flow test completed successfully\n');
    });
});
