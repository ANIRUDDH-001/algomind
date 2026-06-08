/**
 * @codesage
 * @file      playwright.config.ts
 * @purpose   Configuration file for Playwright E2E tests
 * @tech      Playwright, TypeScript, dotenv
 * @connects  Loads .env.local, configures global setup/teardown
 * @apis      none
 * @db        none
 * @state     none
 * @env       Loads TEST_USER_EMAIL and other vars from .env.local via dotenv
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local so TEST_USER_EMAIL (and Supabase service role key) are available
// in global-setup and test files without needing to pass them via shell env.
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        video: 'on-first-retry',
        storageState: '.playwright/auth.json',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],

    globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
    globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180000,
    },
});
