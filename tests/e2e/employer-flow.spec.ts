import { test, expect } from '@playwright/test';

test.describe('Employer campaign flow', () => {
    test('employer can create campaign with RAG context pre-loaded', async ({ page }) => {
        // Login as employer
        // Create new campaign
        // Verify campaign is active with problem assigned
    });

    test('candidate completes assessment and sees dimension feedback', async ({ page }) => {
        // Use test campaign entry code
        // Complete interview
        // Verify /assess/complete shows dimension scores (not hire decision)
    });

    test('employer dashboard shows integrity flags for fast submissions', async ({ page }) => {
        // Login as employer
        // Navigate to campaign detail
        // Verify fast_solution flag appears for test submission with < 90s code
    });
});
