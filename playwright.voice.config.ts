/**
 * @codesage
 * @file      playwright.voice.config.ts
 * @purpose   Isolated Playwright config for the deterministic voice regression suite (tests/e2e/voice-*.spec.ts).
 * @tech      Playwright
 * @connects  tests/e2e/voice-pipeline.spec.ts, tests/e2e/helpers/voice-fakes.ts
 * @apis      none (every backend call is mocked inside the spec)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Deliberately NOT the main playwright.config.ts: that config's globalSetup mints a real Supabase
 * session with the service-role key for TEST_USER_EMAIL. The voice suite needs no real account —
 * it uses the `playwright-e2e` cookie bypass and mocks every API, so it can never touch prod data.
 *
 * Run: npm run test:e2e:voice   (reuses a dev server already on :3000)
 */
export default defineConfig({
    testDir: './tests/e2e',
    testMatch: /voice-.*\.spec\.ts/,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'retain-on-failure',
    },
    projects: [
        // PW_VOICE_CHANNEL=chrome drives the installed Google Chrome (fresh temp profile) instead of
        // Playwright's bundled Chromium — for machines where `npx playwright install` hasn't been run.
        { name: 'voice', use: { ...devices['Desktop Chrome'], channel: process.env.PW_VOICE_CHANNEL || undefined } },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180000,
    },
});
