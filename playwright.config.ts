import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    testMatch: [
        'src/__tests__/integration/**/*.spec.ts',
        'tests/e2e/**/*.spec.ts',
        'tests/a11y/**/*.spec.ts',
        'tests/performance/**/*.spec.ts',
        'tests/visual/**/*.spec.ts',
    ],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        viewport: { width: 1280, height: 720 },
        permissions: ['microphone'], // Mock microphone permission

    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: process.env.CI
            ? 'npm run build && npm start'
            : 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000,
    },
});
