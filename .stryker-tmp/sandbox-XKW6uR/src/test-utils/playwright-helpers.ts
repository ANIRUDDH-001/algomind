/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck

import { Page, Locator, expect } from '@playwright/test';
import { TEST_IDS } from './test-ids';
export { TEST_IDS };

// Grant all permissions needed for voice interviews
export const VOICE_INTERVIEW_PERMISSIONS = ['microphone'];

// Standard setup for interview tests
export async function setupInterviewPage(page: Page, url: string = '/interview') {
    // Grant mic permission at context level to be safe
    await page.context().grantPermissions(VOICE_INTERVIEW_PERMISSIONS);

    // Mock VAD for CI (headless browsers can't use real audio)
    await page.addInitScript(() => {
        (window as any).__PLAYWRIGHT_TEST__ = true;

        // Mock VAD Library (MicVAD)
        (window as any).mockMicVAD = {
            new: async (options: any) => {
                console.log('[MockVAD] Initialized with options:', options);
                (window as any).vadOptions = options; // Expose callbacks for tests to trigger
                return {
                    start: async () => {
                        console.log('[MockVAD] Start');
                        return Promise.resolve();
                    },
                    pause: async () => console.log('[MockVAD] Pause'),
                    destroy: async () => console.log('[MockVAD] Destroy'),
                };
            }
        };

        // Mock TTS (SpeechSynthesis)
        (window as any).speechSynthesis = {
            speak: (utterance: any) => {
                utterance._startMock();
            },
            cancel: () => {
                if ((window as any)._currentUtterance) {
                    (window as any)._currentUtterance._cancelMock();
                }
            },
            pause: () => console.log('[MockTTS] Paused'),
            resume: () => console.log('[MockTTS] Resumed'),
            getVoices: () => [],
            pending: false,
            speaking: false,
            paused: false,
            onvoiceschanged: null,
        };
        (window as any).SpeechSynthesisUtterance = class {
            text = '';
            lang = 'en-US';
            pitch = 1;
            rate = 1;
            volume = 1;
            voice = null;
            onend: any = null;
            onerror: any = null;
            onstart: any = null;
            _timer: any = null;

            constructor(text?: string) {
                this.text = text || '';
            }

            _startMock() {
                (window as any)._currentUtterance = this;
                this._timer = setTimeout(() => {
                    if (this.onstart) {
                        this.onstart(new Event('start'));
                    }
                    this._timer = setTimeout(() => {
                        if (this.onend) {
                            try {
                                this.onend(new Event('end'));
                            } catch (e) {
                                // Silent error to avoid breaking test logic
                            }
                        }
                        (window as any)._currentUtterance = null;
                    }, 100);
                }, 10);
            }

            _cancelMock() {
                if (this._timer) clearTimeout(this._timer);
                if (this.onerror) {
                    this.onerror({ error: 'canceled' });
                }
                (window as any)._currentUtterance = null;
            }
        };

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
    });

    await page.goto(url);
    await page.waitForLoadState('networkidle');

    // Clear onboarding state to ensure it always appears (or never appears if we wanted)
    await page.evaluate(() => localStorage.removeItem('voice_onboarding_seen'));
}

// Wait for interview to be fully ready
export async function waitForInterviewReady(page: Page) {
    // Wait for Begin Interview button
    const beginBtn = page.getByRole('button', { name: /begin interview/i });
    await expect(beginBtn).toBeVisible({ timeout: 10000 });
    await beginBtn.click();

    // Small delay to let the modal mount
    await page.waitForTimeout(1000);

    // Check for Onboarding Modal (it should appear as we cleared localStorage)
    try {
        const onboardingBtn = page.getByTestId('onboarding-complete');
        // Wait up to 12s for the modal
        await onboardingBtn.waitFor({ state: 'visible', timeout: 12000 });
        await onboardingBtn.click();
        console.log('Dismissed onboarding modal');
        // Wait for modal to close fully
        await page.waitForTimeout(500);
    } catch (e) {
        console.log('Onboarding modal did not appear or was not clickable:', e);
    }

    // Wait for the interview interface to load (look for mic button)
    try {
        const micButton = page.getByTestId(TEST_IDS.MIC_BUTTON).last();
        await micButton.waitFor({ state: 'visible', timeout: 15000 });
    } catch (e) {
        console.log('Readiness check (mic button) timed out or failed:', e);
        throw e; // Re-throw to fail the test meaningfully
    }
}

// NEW: Helper to dismiss the onboarding modal if it appears
export async function dismissOnboardingModal(page: Page) {
    try {
        // Look for the modal header
        const modalHeader = page.getByRole('heading', { name: "Welcome to Voice Interviews!" });

        // Wait up to 5000ms for it to appear
        await modalHeader.waitFor({ state: 'visible', timeout: 5000 });
        console.log('[Test] Onboarding modal found. Dismissing...');

        // Click the "Got it, let's start!" button
        const startButton = page.getByRole('button', { name: "Got it, let's start!" });
        await startButton.click();

        // Wait for modal to disappear
        await modalHeader.waitFor({ state: 'hidden', timeout: 5000 });
        console.log('[Test] Onboarding modal dismissed.');
    } catch (e) {
        // If timeout or not found, just continue (it might not be there)
        console.log('[Test] Onboarding modal not found or already dismissed. Continuing...');
    }
}

// Mock API responses for testing
// ---------------------------------------------------------------------------
// Mock Helpers
// ---------------------------------------------------------------------------

export async function mockChatAPI(page: Page, response: string) {
    await page.route('**/api/chat', async (route) => {
        const method = route.request().method();

        // Only mock POST requests (actual chat API calls)
        if (method !== 'POST') {
            await route.continue();
            return;
        }

        console.log('[MOCK] Intercepting /api/chat call');

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                response: response,
                model: 'mock',
                usage: { prompt_tokens: 10, completion_tokens: 20 }
            })
        });
    });

    console.log('[MOCK] Chat API mock installed');
}

export async function mockRateLimit(page: Page) {
    let callCount = 0;
    // Mock the chat endpoint
    await page.route(/.*\/api\/chat.*/, async (route) => {
        // Only intercept POST requests to chat API
        if (route.request().method() !== 'POST') {
            return route.continue();
        }

        callCount++;
        // First call fails with 429
        if (callCount === 1) {
            console.log('Mocking 429 Rate Limit');
            await route.fulfill({
                status: 429,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Too Many Requests' })
            });
        } else {
            // Subsequent calls succeed (if retry creates new request)
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ response: 'Success after retry' })
            });
        }
    });

    return { getCallCount: () => callCount };
}

export async function mockNetworkFailureWithRetry(page: Page, failCount: number = 1) {
    let callCount = 0;
    await page.route(/.*\/api\/chat.*/, async (route) => {
        // Only intercept POST requests
        if (route.request().method() !== 'POST') {
            return route.continue();
        }

        callCount++;
        if (callCount <= failCount) {
            console.log(`Mocking Network Error (${callCount}/${failCount})`);
            await route.abort('failed');
        } else {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ response: 'Success after retry' })
            });
        }
    });

    return { getCallCount: () => callCount };
}

/**
 * Page Object Model for the Interview Panel
 * Scopes all selectors to the primary interview panel to prevent
 * strict mode violations from duplicate elements in split-panel layouts.
 */
export class InterviewPanelPOM {
    private panel: Locator;
    private page: Page;

    constructor(page: Page) {
        this.page = page;
        // Use page root with .first() strategy
        this.panel = page.locator('body').first();
    }

    // Mic controls - always use .first() to avoid strict mode
    micButton() {
        return this.panel.locator('[data-testid="mic-button"]:visible').first();
    }

    micStatusText() {
        return this.panel.locator('[data-testid="mic-status-indicator"]:visible').first();
    }

    vadErrorBanner() {
        return this.panel.locator('[data-testid="vad-error-banner"]:visible').first();
    }

    // Main interview status (THINKING, READY, etc.)
    mainStatus() {
        return this.page.locator('[data-testid="interview-status-main"]:visible').first();
    }

    // Conversation elements
    conversationView() {
        return this.panel.locator('[data-testid="conversation-view"]:visible').first();
    }

    lastMessage() {
        return this.panel.locator('[data-testid="message"]:visible').last();
    }

    thinkingIndicator() {
        return this.panel.locator('[data-testid="thinking-indicator"]:visible').first();
    }

    // Actions with built-in waiting
    async clickMic() {
        await this.micButton().click();
    }

    async getMicStatus(): Promise<string> {
        return await this.micStatusText().textContent() || '';
    }

    async isMicEnabled(): Promise<boolean> {
        return !(await this.micButton().isDisabled());
    }

    // NEW: Wait for interview to be in a stable state (not processing)
    async waitForReady(timeout = 30000) {
        // Wait until status is READY, WAITING, or LISTENING (not THINKING or SPEAKING)
        await this.mainStatus().waitFor({ state: 'visible', timeout: 5000 });

        await expect(this.mainStatus()).toContainText(
            /READY|WAITING|LISTENING/i,
            { timeout }
        );
    }

    // NEW: Wait for mic button to be enabled
    async waitForMicEnabled(timeout = 10000) {
        await expect(this.micButton()).toBeEnabled({ timeout });
    }

    // NEW: Safe click with retry
    async clickMicSafely(retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                await this.waitForMicEnabled(5000);
                await this.micButton().click();
                await this.page.waitForTimeout(500); // Small delay after click
                return true;
            } catch (error) {
                console.log(`Mic click attempt ${i + 1} failed:`, (error as Error).message);
                if (i === retries - 1) throw error;
                await this.page.waitForTimeout(1000);
            }
        }
        return false;
    }
}

/**
 * Debug helper: Take screenshot and dump state when test is stuck
 */
export async function debugInterviewState(page: Page, label: string) {
    console.log(`\n[DEBUG ${label}] Capturing state...`);

    // Screenshot
    await page.screenshot({
        path: `test-results/debug-${label}-${Date.now()}.png`,
        fullPage: true
    });

    // Get all relevant state
    const mainStatus = await page.getByTestId('interview-status-main').textContent().catch(() => 'NOT FOUND');
    const micStatus = await page.getByTestId('mic-status-indicator').first().textContent().catch(() => 'NOT FOUND');
    const micDisabled = await page.getByTestId('mic-button').first().isDisabled().catch(() => true);

    console.log(`[DEBUG ${label}] Main Status: ${mainStatus}`);
    console.log(`[DEBUG ${label}] Mic Status: ${micStatus}`);
    console.log(`[DEBUG ${label}] Mic Disabled: ${micDisabled}`);

    // Get page HTML snippet around mic button
    const micHTML = await page.getByTestId('mic-button').first().evaluate(el => el.outerHTML).catch(() => 'NOT FOUND');
    console.log(`[DEBUG ${label}] Mic Button HTML: ${micHTML.substring(0, 200)}...`);
}
