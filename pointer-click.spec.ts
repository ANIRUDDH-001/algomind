import { test, expect } from '@playwright/test';
import path from 'path';

test('pointer capture breaks clicks on children', async ({ page }) => {
  await page.goto('file://' + path.resolve(__dirname, 'pointer_test.html'));
  await page.click('#btn');
  const log = await page.locator('#log').innerText();
  console.log("Log output: ", log);
});
