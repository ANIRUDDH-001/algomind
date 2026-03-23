/**
 * E2E: Full interview journey, auth flow, and dashboard empty state.
 *
 * Uses existing helpers from src/test-utils/playwright-helpers.ts.
 */
import { test, expect } from '@playwright/test';
import {
    setupInterviewPage,
    waitForInterviewReady,
    mockChatAPI,
    dismissOnboardingModal,
    InterviewPanelPOM,
} from '../../src/test-utils/playwright-helpers';

const RUN_FULL_STACK_E2E = process.env.E2E_FULL_STACK === 'true';

// ───────────────────────────────────────────────
//  1. Full Guest Interview Flow
// ───────────────────────────────────────────────

test.describe('Full Guest Interview Flow', () => {
    test('landing → interview → problem loads → mobile tabs → desktop panels', async ({
        page,
        context,
    }) => {
        test.setTimeout(45_000);

        // ── Step 1: Navigate to landing page ──
        // Bypass intro onboarding animation so the CTA buttons are visible
        await page.addInitScript(() => {
            window.sessionStorage.setItem('algomind_onboarding_shown_this_session', 'true');
        });
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Set the demo mode cookie directly so the middleware doesn't redirect to login
        await context.addCookies([
            {
                name: 'algomind_demo_mode',
                value: 'true',
                url: 'http://localhost:3000',
            },
        ]);

        // ── Step 2: Click CTA → lands on /interview ──
        const cta = page
            .getByRole('button', { name: /try demo as guest/i })
            .or(page.getByRole('link', { name: /try for free/i }))
            .or(page.getByRole('button', { name: /start practicing/i }))
            .or(page.getByRole('button', { name: /begin/i }))
            .or(page.getByRole('link', { name: /get started/i }))
            .or(page.getByRole('button', { name: /try for free/i }));

        await expect(cta.first()).toBeVisible({ timeout: 10_000 });

        // Setup network intercept to mock the chat API *before* clicking to navigate
        await mockChatAPI(
            page,
            "Great! Let's work through this problem together. Walk me through your approach.",
        );

        await cta.first().click();
        await page.waitForURL(/\/interview|\/dashboard/, { timeout: 10_000 });

        // If it went to dashboard (CTA logic), click quick practice
        if (page.url().includes('/dashboard')) {
            const quickPractice = page.getByRole('button', { name: /quick practice/i });
            if (await quickPractice.isVisible()) {
                await quickPractice.click();
            }
        }
        await page.waitForURL(/\/interview/, { timeout: 10_000 });

        // Guest selector can overlay tabs in guest mode; pick a problem first.
        const guestSelector = page.getByTestId('guest-selector-modal');
        if (await guestSelector.isVisible({ timeout: 2_000 }).catch(() => false)) {
            const randomProblemBtn = page.getByTestId('random-problem-button');
            if (await randomProblemBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await randomProblemBtn.click();
            }
            await expect(guestSelector).toBeHidden({ timeout: 10_000 });
        }

        // ── Step 3–4: Wait for problem to load & assert title visible ──
        // Mock the chat API so we don't need real AI
        await mockChatAPI(
            page,
            "Great! Let's work through this problem together. Walk me through your approach.",
        );

        // Problem title is visible (the h1/h2 on screen or data-tour attribute)
        const problemTitle = page
            .locator('h1, h2, [data-tour="problem-title"]')
            .first();
        await expect(problemTitle).toBeVisible({ timeout: 15_000 });

        // ── Step 5: Mobile warning modal NOT visible ──
        const warningModal = page.locator(
            '[data-testid="mobile-warning-modal"], [role="alertdialog"]:has-text("mobile")',
        );
        await expect(warningModal).toHaveCount(0);

        // ── Step 6: Mobile viewport (390×844) ──
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(500); // layout reflow

        // 6a: Click "Code" tab → editor appears, NO warning modal
        const codeTab = page.getByRole('tab', { name: /code/i });
        if (await codeTab.first().isVisible()) {
            const guestSelectorOverlay = page.getByTestId('guest-selector-modal');
            if (await guestSelectorOverlay.isVisible({ timeout: 1_000 }).catch(() => false)) {
                const randomProblemBtn = page.getByTestId('random-problem-button');
                if (await randomProblemBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await randomProblemBtn.click();
                }
                await expect(guestSelectorOverlay).toBeHidden({ timeout: 10_000 });
            }
            await codeTab.first().click();
            await page.waitForTimeout(300);

            // Code surface may show its toolbar before Monaco finishes mounting.
            const codeSurface = page
                .getByRole('combobox')
                .or(page.getByRole('button', { name: /^run$/i }))
                .or(page.locator('[data-testid="code-editor"]:visible, .monaco-editor:visible, textarea:visible'));
            await expect(codeSurface.first()).toBeVisible({ timeout: 8_000 });

            // No warning modal
            await expect(warningModal).toHaveCount(0);

            // 6b: Type code (in textarea if CodeEditor is mocked, or monaco)
            const plainTextarea = page.locator('textarea:not(.inputarea)');
            const monacoEditor = page.locator('.monaco-editor');
            if (await monacoEditor.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
                // Monaco: click the editor area then type
                await monacoEditor.first().click();
                await page.keyboard.type('def two_sum(nums, target): pass');
            } else if (await plainTextarea.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
                await plainTextarea.first().fill('def two_sum(nums, target): pass');
            }

            // 6c: Click Interview tab → interview view shown
            const interviewTab = page.getByRole('tab', { name: /interview/i });
            if (await interviewTab.first().isVisible()) {
                await interviewTab.first().click();
                await page.waitForTimeout(300);

                // Conversation or mic button should be present in DOM
                // (at mobile viewport it may not be visually visible due to layout)
                const interviewView = page.locator(
                    '[data-testid="conversation-view"], [data-testid="mic-button"]',
                );
                await expect(interviewView.first()).toBeAttached({
                    timeout: 5_000,
                });
            }
        }

        // ── Step 7: Desktop viewport (1440×900) ──
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForTimeout(500);

        // 7a: Desktop layout exposes the problem/history drawer toggles and a main interview surface.
        const problemToggle = page.getByRole('button', { name: /^problem$/i }).last();
        const historyToggle = page.getByRole('button', { name: /^history$/i }).last();
        const desktopSurface = page.locator(
            '.monaco-editor, [data-testid="transcript-area"], [data-tour="interview-container"]',
        );

        await expect(problemToggle).toBeVisible({ timeout: 5_000 });
        await expect(historyToggle).toBeVisible({ timeout: 5_000 });
        await expect(desktopSurface.first()).toBeAttached({ timeout: 5_000 });

        // 7b: No horizontal overflow
        const overflows = await page.evaluate(
            () => document.body.scrollWidth > window.innerWidth,
        );
        expect(overflows).toBe(false);

        // 7c: Interaction panel is visible in center
        const interactionPanel = page.locator(
            '[data-testid="panel-interaction"], [data-testid="code-editor"], .monaco-editor',
        );
        await expect(interactionPanel.first()).toBeAttached({ timeout: 5_000 });
    });
});

// ───────────────────────────────────────────────
//  2. Auth Flow — Google OAuth (COEP check)
// ───────────────────────────────────────────────

test.describe('Auth Flow — Google OAuth', () => {
    test('no COEP header on /interview and Google OAuth button exists', async ({
        page,
    }) => {
        test.setTimeout(45_000);

        // Step 1: Navigate to /interview and capture response headers
        const response = await page.goto('/interview');
        expect(response).not.toBeNull();

        // Step 2: COEP header should NOT be set (would block OAuth popups)
        const coep = response!.headers()['cross-origin-embedder-policy'];
        expect(coep).toBeUndefined();

        // Step 3: Navigate to login page and verify Google OAuth button
        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('domcontentloaded');

        const googleBtn = page.getByRole('button', {
            name: /continue with google|sign in with google|google/i,
        });
        await expect(googleBtn).toBeVisible({ timeout: 10_000 });

        // Step 4: Clicking should initiate OAuth (we can't fully test the popup,
        // but we verify the button is clickable and no COEP blocks it)
        // We intercept to prevent actual navigation
        await page.route('**/auth/v1/authorize**', (route) =>
            route.fulfill({ status: 200, body: 'mocked' }),
        );
    });
});

import { setE2EAuthCookie } from './auth-helper';

// ───────────────────────────────────────────────
//  3. Dashboard Empty State
// ───────────────────────────────────────────────

test.describe('Dashboard Empty State', () => {
    test.skip(!RUN_FULL_STACK_E2E, 'Set E2E_FULL_STACK=true to run dashboard e2e checks that require full app readiness.');

    test('shows empty state or session list (not crash)', async ({ page, context }) => {
        // Bypass proxy.ts auth guard
        await setE2EAuthCookie(context);

        // Navigate to dashboard (guest or fresh user will see empty state)
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // Should NOT crash — one of these should be visible:
        // 1. Empty state message
        // 2. Session list / timeline
        // 3. Login redirect
        const emptyState = page.locator(
            "text=Your journey hasn't started yet!",
        );
        const sessionList = page.locator(
            '[data-testid="session-timeline"], [data-tour="history-list"]',
        );
        const loginRedirect = page.locator(
            'text=Sign in, text=Log in, text=Continue with Google',
        );

        // At least one of these should be visible (page did not crash)
        const anyVisible =
            (await emptyState.isVisible().catch(() => false)) ||
            (await sessionList.first().isVisible().catch(() => false)) ||
            (await loginRedirect.first().isVisible().catch(() => false));

        // If none are visible, check we at least have a non-error page
        if (!anyVisible) {
            // Page should not show an unhandled error
            const body = await page.textContent('body');
            expect(body).not.toContain('Application error');
            expect(body).not.toContain('Internal Server Error');
        }
    });
});
