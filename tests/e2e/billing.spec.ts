import { test, expect } from '@playwright/test';
import { signIn } from './helpers/auth';

test.describe('Billing & Subscription Flow', () => {
    test.beforeEach(async ({ page }) => {
        const ok = await signIn(page);
        test.skip(!ok, 'Auth not available');
    });

    test('user can click upgrade button and initiate checkout', async ({ page }) => {
        // Mock the Razorpay script loading and object so we don't actually open real Razorpay
        await page.route('https://checkout.razorpay.com/v1/checkout.js', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: `
                    window.Razorpay = function(options) {
                        this.open = function() {
                            // Automatically call the handler to simulate successful payment
                            if (options.handler) {
                                setTimeout(() => {
                                    options.handler({
                                        razorpay_order_id: 'order_test_123',
                                        razorpay_payment_id: 'pay_test_123',
                                        razorpay_signature: 'sig_test_123'
                                    });
                                }, 500);
                            }
                        };
                    };
                `
            });
        });

        // Mock the backend endpoints so we don't create real orders
        await page.route('/api/payment/create-order', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    json: {
                        keyId: 'test_key',
                        amount: 49900,
                        currency: 'INR',
                        orderId: 'order_test_123'
                    }
                });
            } else {
                route.continue();
            }
        });

        await page.route('/api/payment/verify', async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    json: { success: true }
                });
            } else {
                route.continue();
            }
        });

        // Go to settings page
        await page.goto('/settings');

        // Click the upgrade button
        const upgradeBtn = page.locator('button:has-text("Go Pro")');
        await expect(upgradeBtn).toBeVisible({ timeout: 10000 });
        await upgradeBtn.click();

        // Expect the success toast
        await expect(page.locator('text=Welcome to AlgoMind Pro')).toBeVisible({ timeout: 5000 });
    });
});
