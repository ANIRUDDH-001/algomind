import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? 'aniruddhvijayvargia@gmail.com';

/**
 * Get a real Supabase session by using the admin API to generate a sign-in
 * link and then exchanging the OTP token directly — no browser redirect needed.
 *
 * Flow:
 *   1. Call admin generate_link to get the token (OTP hash)
 *   2. Call auth.verifyOtp({ token_hash, type: 'magiclink' }) on the anon client
 *   3. Save the resulting session to .playwright/auth.json as localStorage entries
 */
async function buildAuthState(baseUrl: string): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.warn('[e2e/global-setup] Supabase env vars missing — skipping auth setup.');
    return false;
  }

  // Step 1: Generate a magic link OTP token via admin API
  let tokenHash: string;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', email: TEST_USER_EMAIL }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.warn(`[e2e/global-setup] generate_link failed (${res.status}): ${body}`);
      return false;
    }

    const data = await res.json();
    // Supabase v2 returns { properties: { hashed_token, ... }, action_link }
    tokenHash = data.properties?.hashed_token ?? data.hashed_token;

    if (!tokenHash) {
      // Fall back: extract token from action_link URL fragment
      const actionLink: string = data.action_link ?? '';
      const match = actionLink.match(/token=([^&]+)/);
      if (match) tokenHash = match[1];
    }

    if (!tokenHash) {
      console.warn('[e2e/global-setup] Could not extract token hash from generate_link response:', JSON.stringify(data));
      return false;
    }
    console.log('[e2e/global-setup] Got magic link token hash ✓');
  } catch (err) {
    console.warn('[e2e/global-setup] generate_link error:', err);
    return false;
  }

  // Step 2: Exchange the OTP token for a session using the anon client
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  let session;
  try {
    const { data: authData, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (error || !authData?.session) {
      console.warn('[e2e/global-setup] verifyOtp failed:', error?.message ?? 'no session');
      return false;
    }

    session = authData.session;
    console.log(`[e2e/global-setup] Session obtained for ${session.user?.email} ✓`);
  } catch (err) {
    console.warn('[e2e/global-setup] verifyOtp error:', err);
    return false;
  }

  // Step 3: Inject the session into a browser context and save storage state
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
  const sessionValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
    user: session.user,
  });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to app to establish the origin for localStorage
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Inject Supabase session into localStorage
    await page.evaluate(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [storageKey, sessionValue]
    );

    // Add the playwright-e2e cookie
    await context.addCookies([{ name: 'playwright-e2e', value: 'true', url: baseUrl }]);

    const authDir = path.join(process.cwd(), '.playwright');
    fs.mkdirSync(authDir, { recursive: true });
    await context.storageState({ path: path.join(authDir, 'auth.json') });

    console.log(`[e2e/global-setup] Auth state saved (localStorage key: ${storageKey}) ✓`);
    return true;
  } catch (err) {
    console.warn('[e2e/global-setup] Failed to inject session into browser:', err);
    return false;
  } finally {
    await browser.close();
  }
}

async function tryCredentialLogin(baseUrl: string): Promise<boolean> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) return false;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const route of ['/auth/login', '/login']) {
    await page.goto(`${baseUrl}${route}`);

    const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="email-input"]');
    const passwordInput = page.locator('input[name="password"], input[type="password"], [data-testid="password-input"]');

    if (await emailInput.first().isVisible().catch(() => false) && await passwordInput.first().isVisible().catch(() => false)) {
      await emailInput.first().fill(email);
      await passwordInput.first().fill(password);
      const submit = page.locator('[type="submit"], [data-testid="sign-in-button"]');
      await submit.first().click();
      await page.waitForLoadState('networkidle');
      break;
    }
  }

  const authDir = path.join(process.cwd(), '.playwright');
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: path.join(authDir, 'auth.json') });
  await browser.close();
  return true;
}

export default async function globalSetup() {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const authDir = path.join(process.cwd(), '.playwright');
  fs.mkdirSync(authDir, { recursive: true });

  // Write minimal fallback auth.json first (for unauthenticated tests)
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([{ name: 'playwright-e2e', value: 'true', url: baseUrl }]);
  await context.storageState({ path: path.join(authDir, 'auth.json') });
  await browser.close();

  // Prefer email/password if explicitly provided (non-OAuth test user)
  if (await tryCredentialLogin(baseUrl)) {
    console.log('[e2e/global-setup] Auth via email/password ✓');
    return;
  }

  // Use Supabase magic link token exchange (works without app running — no redirect needed)
  if (!(await buildAuthState(baseUrl))) {
    console.warn('[e2e/global-setup] Auth setup failed — authenticated tests will fail.');
  }
}
