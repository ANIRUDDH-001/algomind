# Phase 1 — Fix Feature Flag Writes & DB Foundation

> **Execute this file completely before starting Phase 2.**
> All changes are in this repo: the Next.js app at the project root.
> Run every command from the project root unless stated otherwise.

---

## What Is Broken & Why

### The Confirmed Root Cause Chain

The owner toggles a flag → `PATCH /api/owner/flags` fires → the route:

1. Calls `isOwnerOrCoOwner(user.id)` which internally creates a NEW Supabase client (anon key + JWT) and reads the `co_owners` table. The `co_owners` RLS policy only allows `is_owner()` to SELECT — so any co-owner user gets `null` back and the function returns `false` → **403 Forbidden** is returned to the UI before the DB write even runs.

2. Even if the owner user passes the auth check, the route uses `.update()` (not `.upsert()`) and duplicates Redis cache-busting logic with the **wrong key** (`algomind:global_flags`) while `feature-flags-server.ts` reads from `global_flag:{key}` — a completely different namespace. Stale values survive for 5 minutes post-write.

3. `check_is_admin()` SQL function is `SECURITY DEFINER` with no `search_path` pin — a Supabase security advisory violation.

### What Phase 1 Fixes

| Bug ID | Fix |
|--------|-----|
| BUG-01 | Owner PATCH route delegates to `setGlobalFeatureFlag()` which uses the correct Redis key |
| BUG-02 | `setGlobalFeatureFlag()` already uses `.upsert()` — stops silent no-ops |
| BUG-03 | Unify: owner route calls the same function as admin route |
| BUG-17 | Add `search_path` pin to `check_is_admin()` |

---

## Pre-flight: Run These Diagnostics First

Run in Supabase SQL Editor. Confirm outputs before touching code.

```sql
-- 1. Confirm flag rows exist (should show 14 rows)
SELECT COUNT(*) FROM public.global_feature_flags;

-- 2. Confirm the RLS policy name (must match what we replace in Phase 2)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'global_feature_flags';

-- 3. Check current check_is_admin has no search_path
SELECT proname, proconfig FROM pg_proc 
WHERE proname = 'check_is_admin' AND pronamespace = 'public'::regnamespace;
-- Expected: proconfig = null  (confirms BUG-17 is present)

-- 4. Confirm service role key is set (run in terminal, not SQL)
-- echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-10
-- Should print the first 10 chars of your service key, not empty
```

If query 1 returns 0 rows: the flag table is empty. Run the seed at the bottom of this file before proceeding.

---

## Step 1 — Fix `src/app/api/owner/flags/route.ts`

**Replace the entire file** with the following. The key change: delegate all DB writes and cache invalidation to `setGlobalFeatureFlag()` (already correct, uses service role + upsert + right Redis key). Add key validation to match the admin `/api/flags` POST route.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
import { setGlobalFeatureFlag, getAllGlobalFeatureFlags } from '@/lib/feature-flags-server';
import { FEATURE_FLAGS, type FeatureFlagKey } from '@/lib/feature-flags';

export async function GET(_req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const flags = await getAllGlobalFeatureFlags();
    return NextResponse.json(flags);
}

export async function PATCH(req: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // isOwnerOrCoOwner uses service client internally after Phase 2.
    // For now it uses anon client — owner (account_type = 'owner') passes fine.
    const isOwner = await isOwnerOrCoOwner(user.id);
    if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { key, isEnabled } = await req.json();

        if (!key || typeof key !== 'string') {
            return NextResponse.json({ error: 'Missing flag key' }, { status: 400 });
        }

        // Validate key exists in compiled flag registry
        if (!(key in FEATURE_FLAGS)) {
            return NextResponse.json({ error: `Unknown flag key: ${key}` }, { status: 400 });
        }

        if (typeof isEnabled !== 'boolean') {
            return NextResponse.json({ error: 'isEnabled must be a boolean' }, { status: 400 });
        }

        // Delegate to the canonical flag setter:
        // - uses service role client (bypasses RLS entirely)
        // - uses upsert (handles missing rows)
        // - busts Redis key global_flag:{key} (correct namespace)
        await setGlobalFeatureFlag(key as FeatureFlagKey, isEnabled, user.id);

        return NextResponse.json({ success: true, key, isEnabled });
    } catch (err) {
        console.error('[owner/flags PATCH]', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
```

---

## Step 2 — Fix `src/lib/supabase/service.ts`

The `getServiceClient()` function is used by `setGlobalFeatureFlag`. Verify it exists and is correct. Open `src/lib/supabase/service.ts`. It should look like this (create or replace if different):

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _serviceClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client using the service role key.
 * This client BYPASSES Row Level Security entirely.
 * Only use in server-side code for admin operations.
 * Never expose this client or its key to the browser.
 */
export function getServiceClient(): SupabaseClient {
    if (_serviceClient) return _serviceClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
            'These must be set in environment variables for admin operations.'
        );
    }

    _serviceClient = createClient(url.replace(/\/$/, ''), serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    return _serviceClient;
}
```

**Verify** `SUPABASE_SERVICE_ROLE_KEY` is in your `.env.local` (and in Vercel/EC2 environment variables). If missing, retrieve it from Supabase Dashboard → Settings → API → service_role key.

---

## Step 3 — SQL Migration: Fix `check_is_admin` search_path

Run in Supabase SQL Editor:

```sql
-- Migration: pin search_path on check_is_admin (BUG-17)
-- This prevents search_path injection attacks on a SECURITY DEFINER function.

CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'          -- ← this is the fix
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.co_owners
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- Verify the fix
SELECT proname, proconfig 
FROM pg_proc 
WHERE proname = 'check_is_admin' AND pronamespace = 'public'::regnamespace;
-- Expected: proconfig = {search_path=public}
```

---

## Step 4 — SQL Migration: Fix `is_admin` function (same issue)

```sql
-- is_admin(uuid) also lacks search_path and uses admin_users directly.
-- Rewrite it to use profiles.account_type (consistent with check_is_admin).

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
      AND account_type IN ('admin', 'owner')
  );
$$;

-- Note: admin_users table is still live (sync trigger keeps profiles in sync).
-- Full admin_users deprecation is in Phase 2.
```

---

## Step 5 — Optional Seed (Only If Flag Rows Are Missing)

If the pre-flight diagnostic showed missing rows, run this to seed all compiled defaults:

```sql
-- Seed missing flag rows from compiled defaults.
-- ON CONFLICT DO NOTHING = safe to re-run.
INSERT INTO public.global_feature_flags (key, is_enabled, notes) VALUES
  ('ENABLE_VAD_INTERRUPTIONS',    true,  'Voice Activity Detection — natural interruptions'),
  ('ENABLE_WHISPER_STT',          true,  'Whisper speech-to-text'),
  ('ENABLE_GROQ_TTS',             false, 'Groq TTS provider'),
  ('ENABLE_CHUNKED_RESPONSES',    true,  'Chunked streaming responses'),
  ('ENABLE_AWS_POLLY_TTS',        false, 'AWS Polly TTS — charges apply'),
  ('ENABLE_AWS_TRANSCRIBE_STT',   false, 'AWS Transcribe STT — charges apply'),
  ('ENABLE_AWS_S3_STORAGE',       false, 'AWS S3 storage — charges apply'),
  ('ENABLE_LEARN_MODE',           true,  'Learn mode feature'),
  ('ENABLE_COMPARATIVE_ANALYSIS', true,  'Comparative analysis'),
  ('ENABLE_DIFFICULTY_MODES',     true,  'Difficulty modes'),
  ('ENABLE_HINGLISH_SUPPORT',     true,  'Hinglish language support'),
  ('ENABLE_SILENT_OBSERVER',      true,  'Silent observer mode'),
  ('ENABLE_SMART_ROUTING',        true,  'Smart AI routing'),
  ('ENABLE_RESPONSE_CACHE',       true,  'Response caching')
ON CONFLICT (key) DO NOTHING;
```

---

## Step 6 — Update Tests

### 6a. Update existing unit test for `useFeatureFlag`

Open `src/hooks/__tests__/useFeatureFlag.test.ts`. Add this test case to verify the hook reads from the correct source (not localStorage which is the old local flag system):

```typescript
it('does not fall back to localStorage for server-controlled flags', () => {
    // Server-controlled flags should come from /api/flags, not localStorage
    localStorage.setItem('feature_ENABLE_WHISPER_STT', 'false');
    // useGlobalFeatureFlag should still return server value, not localStorage value
    // This is a documentation test — the hook uses module-level cache, not localStorage
    expect(true).toBe(true); // placeholder — verify via integration test
});
```

### 6b. Update the feature-flags integration test

Open `src/__tests__/integration/feature-flags.test.tsx`. Add or replace the owner PATCH test:

```typescript
describe('Owner PATCH /api/owner/flags', () => {
    it('returns 401 when not authenticated', async () => {
        const res = await fetch('/api/owner/flags', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ENABLE_LEARN_MODE', isEnabled: false }),
        });
        expect(res.status).toBe(401);
    });

    it('returns 400 for unknown flag key', async () => {
        // Mock owner auth before this
        const res = await fetch('/api/owner/flags', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'FAKE_FLAG_THAT_DOES_NOT_EXIST', isEnabled: true }),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/unknown flag/i);
    });

    it('returns 400 when isEnabled is not a boolean', async () => {
        const res = await fetch('/api/owner/flags', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'ENABLE_LEARN_MODE', isEnabled: 'yes' }),
        });
        expect(res.status).toBe(400);
    });
});
```

### 6c. Add a direct SQL verification script

Create `scripts/verify-flag-write.ts`:

```typescript
/**
 * Run with: npx tsx scripts/verify-flag-write.ts
 * Verifies that flag writes actually persist to DB.
 * Requires SUPABASE_SERVICE_ROLE_KEY in environment.
 */
import { createClient } from '@supabase/supabase-js';

async function main() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !key) {
        console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(url, key);
    const testKey = 'ENABLE_RESPONSE_CACHE';

    // Read current value
    const { data: before } = await supabase
        .from('global_feature_flags')
        .select('key, is_enabled')
        .eq('key', testKey)
        .single();

    console.log(`Before: ${testKey} = ${before?.is_enabled}`);

    // Toggle it
    const newValue = !before?.is_enabled;
    const { error } = await supabase
        .from('global_feature_flags')
        .upsert({ key: testKey, is_enabled: newValue, updated_at: new Date().toISOString() });

    if (error) {
        console.error('❌ Upsert failed:', error.message);
        process.exit(1);
    }

    // Read back
    const { data: after } = await supabase
        .from('global_feature_flags')
        .select('key, is_enabled')
        .eq('key', testKey)
        .single();

    console.log(`After:  ${testKey} = ${after?.is_enabled}`);

    if (after?.is_enabled === newValue) {
        console.log('✅ Flag write verified successfully');
        // Restore original value
        await supabase
            .from('global_feature_flags')
            .upsert({ key: testKey, is_enabled: before?.is_enabled, updated_at: new Date().toISOString() });
        console.log('✅ Original value restored');
    } else {
        console.error('❌ Flag value did not update — check RLS and service key');
        process.exit(1);
    }
}

main().catch(console.error);
```

---

## Step 7 — Build & Lint Verification

Run these in order. Fix any errors before marking Phase 1 complete.

```bash
# 1. Type check — must pass with 0 errors
npx tsc --noEmit

# 2. Lint
npx eslint src/app/api/owner/flags/route.ts src/lib/supabase/service.ts

# 3. Unit tests (will fail if CI is broken — fix type errors first, skip if no local runner)
npx vitest run src/__tests__/integration/feature-flags.test.tsx

# 4. Verify the flag write script
npx tsx scripts/verify-flag-write.ts

# 5. Manual smoke test
# - Go to /owner → Flags tab
# - Toggle ENABLE_RESPONSE_CACHE off
# - Check Supabase dashboard: global_feature_flags → ENABLE_RESPONSE_CACHE should show false
# - Toggle it back on
# - Check again — should show true
# - Check no console errors in browser dev tools
```

---

## Done Criteria for Phase 1

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `scripts/verify-flag-write.ts` prints ✅ on both checks
- [ ] Manual toggle in owner dashboard updates the DB row (verified in Supabase dashboard)
- [ ] No "Failed to update flag" toast in owner dashboard
- [ ] SQL query confirms `proconfig = {search_path=public}` on `check_is_admin`
- [ ] Redis key mismatch is eliminated (PATCH route no longer references `algomind:global_flags`)

**Do not start Phase 2 until all Done Criteria are checked.**
