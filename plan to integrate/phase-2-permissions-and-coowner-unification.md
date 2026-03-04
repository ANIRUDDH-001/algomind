# Phase 2 — Permissions & Co-owner Unification

> **Prerequisite: Phase 1 Done Criteria must be fully checked before starting.**
> This phase touches the DB schema, RLS policies, triggers, and 4 application files.
> Every SQL block must be run in sequence — they are not idempotent unless noted.

---

## What Is Broken & Why

### The Co-owner RLS Trap (Root of BUG-04)

`co_owners` has exactly one RLS policy: `is_owner()`. This means:
- Only a user with `profiles.account_type = 'owner'` can SELECT from `co_owners`.
- A co-owner user trying to verify their own co-owner status gets an empty result → function returns false → 403.
- The **primary owner** can read `co_owners` fine, but **all application-level co-owner checks fail** for any co-owner user because the read is blocked before the comparison.

### The Four Divergent Admin Check Paths (BUG-13)

| Location | Logic | Outcome |
|---|---|---|
| `middleware.ts` | `profiles.account_type = 'owner'` OR `co_owners.user_id = user.id` | Uses `user_id` |
| `account-type.ts: isOwnerOrCoOwner()` | `profiles.account_type = 'owner'` OR `co_owners.email = profile.email` | Uses email |
| `owner/page.tsx` | Same as `isOwnerOrCoOwner` | Uses email |
| `get_my_permissions()` SQL | `co_owners.email = v_email` | Uses email only |

The `co_owners.user_id` column exists (with FK to profiles) but is nullable and not populated by the invite flow. Email is the canonical identifier right now. The fix: standardize everything on **email** (since that's what's populated), fix the one outlier (middleware), and add a `user_id`-population trigger for future-proofing.

### The JWT Sync Gap (BUG-15)

When a user is added to `co_owners`, no trigger updates their JWT. They must sign out and back in. We add a trigger on `co_owners` INSERT to handle this.

### Admin Permission Scope Clarification

Per your confirmation: admins manage other admins + employers only. They do NOT access owner-level features. The `check_is_admin()` function currently includes co-owners as admins — that is correct for API guard purposes only. The flag-write path now uses service role (Phase 1) so this no longer gates flag writes.

### What Phase 2 Fixes

| Bug ID | Fix |
|--------|-----|
| BUG-04 | Standardize co-owner lookup to email everywhere; fix middleware to use email |
| BUG-06 | RLS on `global_feature_flags` updated to use `check_is_admin()` (which includes co-owners) |
| BUG-13 | Single `isOwnerOrCoOwner()` utility, consistent across all callers |
| BUG-14 | `get_my_permissions()` updated to check both user_id and email |
| BUG-15 | Trigger on `co_owners` populates user_id on signup to sync permissions |

---

## Pre-flight: Run These Before Any Changes

```sql
-- 1. Count co_owners with and without user_id
SELECT 
    COUNT(*) AS total,
    COUNT(user_id) AS has_user_id,
    COUNT(*) - COUNT(user_id) AS email_only
FROM public.co_owners;

-- 2. See all policies on co_owners
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'co_owners';
-- Expected: only "Owner can manage co_owners"

-- 3. Check get_my_permissions function body
SELECT prosrc FROM pg_proc 
WHERE proname = 'get_my_permissions' AND pronamespace = 'public'::regnamespace;

-- 4. Verify middleware co_owner check field (informational only — no SQL needed)
-- Just note: middleware.ts uses .eq('user_id', user.id) — this is the outlier to fix
```

---

## Step 1 — SQL Migration: Fix Co-owner RLS Policies

Run in Supabase SQL Editor. Run all in one transaction.

```sql
BEGIN;

-- 1a. Drop the restrictive single policy
DROP POLICY IF EXISTS "Owner can manage co_owners" ON public.co_owners;

-- 1b. Owner can do everything (existing behavior preserved)
CREATE POLICY "Owner full access to co_owners"
ON public.co_owners
FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- 1c. Co-owner can read their own row (self-lookup)
-- This is what isOwnerOrCoOwner() needs to function correctly
CREATE POLICY "Co-owner can read own record"
ON public.co_owners
FOR SELECT
TO authenticated
USING (
    -- Match by user_id if populated
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR
    -- Match by email as fallback (current state for existing rows)
    (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
);

COMMIT;

-- Verify new policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'co_owners';
-- Expected: 2 rows — "Owner full access to co_owners" + "Co-owner can read own record"
```

---

## Step 2 — SQL Migration: Populate `co_owners.user_id` for Existing Rows

This backfills `user_id` for any co-owner rows where it's null (email-only rows from the invite flow).

```sql
-- Backfill user_id for existing co-owner rows
UPDATE public.co_owners co
SET user_id = au.id
FROM auth.users au
WHERE co.email = au.email
  AND co.user_id IS NULL;

-- Verify backfill
SELECT email, user_id FROM public.co_owners;
-- user_id should now be populated for any user who has signed up
```

---

## Step 3 — SQL Migration: Add Trigger to Auto-populate `co_owners.user_id`

For future co-owner grants where the user already exists, auto-link user_id on insert.

```sql
-- Function: when a co_owner row is inserted, try to link the user_id from auth.users
CREATE OR REPLACE FUNCTION public.link_co_owner_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
        SELECT id INTO NEW.user_id
        FROM auth.users
        WHERE email = NEW.email
        LIMIT 1;
        -- If user hasn't signed up yet, user_id stays null (populated later via Step 4 trigger)
    END IF;
    RETURN NEW;
END;
$$;

-- Trigger on INSERT
DROP TRIGGER IF EXISTS trg_link_co_owner_user_id ON public.co_owners;
CREATE TRIGGER trg_link_co_owner_user_id
    BEFORE INSERT ON public.co_owners
    FOR EACH ROW
    EXECUTE FUNCTION public.link_co_owner_user_id();
```

---

## Step 4 — SQL Migration: Trigger to Link Co-owner When User Signs Up

When a user signs up with an email that's already in `co_owners`, backfill their `user_id`.

```sql
-- This attaches to the handle_new_user trigger chain.
-- When a new profile is created (user signs up), check if their email is in co_owners and link them.
CREATE OR REPLACE FUNCTION public.link_profile_to_co_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- When a new profile is created, link the user_id in co_owners if their email matches
    UPDATE public.co_owners
    SET user_id = NEW.id
    WHERE email = NEW.email
      AND user_id IS NULL;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_profile_to_co_owner ON public.profiles;
CREATE TRIGGER trg_link_profile_to_co_owner
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.link_profile_to_co_owner();

-- Verify trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_link_profile_to_co_owner';
```

---

## Step 5 — SQL Migration: Fix `get_my_permissions()`

Update to check both `user_id` and email for co-owner lookup (BUG-14).

```sql
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(
    is_owner boolean,
    is_co_owner boolean,
    is_admin boolean,
    is_employer boolean,
    account_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_email TEXT;
    v_type  TEXT;
    v_uid   UUID;
BEGIN
    v_uid := auth.uid();
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    SELECT account_type INTO v_type FROM public.profiles WHERE id = v_uid;

    RETURN QUERY SELECT
        (v_type = 'owner'),
        -- Check by user_id first (most reliable), fallback to email
        EXISTS(
            SELECT 1 FROM public.co_owners
            WHERE (user_id = v_uid)
               OR (user_id IS NULL AND email = v_email)
        ),
        (v_type IN ('admin', 'owner')),
        (v_type IN ('employer', 'admin', 'owner')),
        v_type;
END;
$$;
```

---

## Step 6 — SQL Migration: Update `global_feature_flags` RLS

The current RLS policy does a cross-schema `auth.users` subquery. Replace it with `check_is_admin()` (which already does the same lookup internally, but is SECURITY DEFINER so it runs as the owner of the function, not the anon role — more reliable).

Note: flag writes now go through service role (Phase 1), so this policy only guards direct PostgREST calls. But it should still be correct.

```sql
-- Drop existing modify policy
DROP POLICY IF EXISTS "Admins and owners modify flags" ON public.global_feature_flags;

-- Recreate using check_is_admin() which handles profiles + co_owners lookup correctly
CREATE POLICY "Admins and owners modify flags"
ON public.global_feature_flags
FOR ALL
TO authenticated
USING (public.check_is_admin())
WITH CHECK (public.check_is_admin());

-- Verify
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'global_feature_flags';
-- Expected: 2 rows — "Anyone can read flags" (SELECT) + "Admins and owners modify flags" (ALL)
```

---

## Step 7 — Fix `src/middleware.ts`

The middleware uses `co_owners.user_id` to check co-owner status. This is the one outlier — standardize it to email (since `user_id` is nullable and email is the canonical field until backfill is confirmed complete for all environments).

Find this block in `src/middleware.ts`:

```typescript
// FIND THIS:
let isCoOwner = false;
if (!isOwner) {
    const { data: coOwner } = await supabase
        .from('co_owners')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
    isCoOwner = !!coOwner;
}
```

Replace with:

```typescript
// REPLACE WITH:
let isCoOwner = false;
if (!isOwner) {
    // Check by user_id first (populated after Phase 2 backfill),
    // fall back to email for rows created before the backfill.
    const { data: coOwner } = await supabase
        .from('co_owners')
        .select('id')
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .limit(1)
        .maybeSingle();
    isCoOwner = !!coOwner;
}
```

> Note: `user.email` is available from `supabase.auth.getUser()` — confirm `user.email` is accessed in scope above this block. If not, destructure it from `user` earlier in the middleware.

---

## Step 8 — Fix `src/lib/auth/account-type.ts`

The `isOwnerOrCoOwner` function uses a new Supabase client (anon key). After Phase 2, the co-owner SELECT RLS policy allows co-owners to read their own row. But for defence-in-depth, switch the co-owner check inside `isOwnerOrCoOwner` to use the service client so it cannot be blocked by any future RLS changes.

Replace the `isOwnerOrCoOwner` function:

```typescript
export async function isOwnerOrCoOwner(userId: string): Promise<boolean> {
    // Use server client (anon + JWT) to read own profile
    const supabase = await createServerSupabase();
    const { data: profile } = await supabase
        .from('profiles')
        .select('account_type, email')
        .eq('id', userId)
        .single();

    if (profile?.account_type === 'owner') return true;

    if (!profile?.email) return false;

    // Use service client for co_owners lookup — bypasses RLS entirely.
    // This is safe: we already verified the user's identity via getUser() in the caller.
    const { getServiceClient } = await import('@/lib/supabase/service');
    const serviceClient = getServiceClient();
    const { data: coOwner } = await serviceClient
        .from('co_owners')
        .select('id')
        .or(`user_id.eq.${userId},email.eq.${profile.email}`)
        .limit(1)
        .maybeSingle();

    return !!coOwner;
}
```

---

## Step 9 — Fix `src/app/owner/page.tsx`

The owner page duplicates the co-owner check inline. Replace with the now-fixed `isOwnerOrCoOwner`:

Find and replace this block in `src/app/owner/page.tsx`:

```typescript
// FIND THIS:
if (profile?.account_type !== 'owner') {
    // Check co_owners table
    const { data: coOwner } = await supabase
        .from('co_owners')
        .select('id')
        .eq('email', user.email || '')
        .maybeSingle();

    if (!coOwner) {
        redirect('/dashboard');
    }
}
```

```typescript
// REPLACE WITH:
const hasAccess = await isOwnerOrCoOwner(user.id);
if (!hasAccess) {
    redirect('/dashboard');
}
```

Make sure `isOwnerOrCoOwner` is imported at the top of the file:
```typescript
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';
```

---

## Step 10 — Verify `check_is_admin` Covers Co-owners for Admin API

`check_is_admin()` is used by `requireAdminForApi()` which gates the `/api/flags` POST route (admin can also toggle flags). Confirm it still includes co-owners by running:

```sql
-- Verify check_is_admin still includes co-owner path
SELECT prosrc FROM pg_proc 
WHERE proname = 'check_is_admin' AND pronamespace = 'public'::regnamespace;
-- Should show co_owners email check in the OR clause
```

If the function from Phase 1 Step 3 removed the co-owner check, add it back now:

```sql
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND account_type IN ('admin', 'owner')
  )
  OR EXISTS (
    SELECT 1 FROM public.co_owners
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
       OR user_id = auth.uid()
  );
$$;
```

---

## Step 11 — Add New Test: Co-owner Permission Flow

Create `src/__tests__/api/co-owner-permissions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOwnerOrCoOwner } from '@/lib/auth/account-type';

vi.mock('@/lib/supabase/server', () => ({
    createServerSupabase: vi.fn(),
}));
vi.mock('@/lib/supabase/service', () => ({
    getServiceClient: vi.fn(),
}));

describe('isOwnerOrCoOwner', () => {
    const mockServerClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
    };
    const mockServiceClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        const { createServerSupabase } = require('@/lib/supabase/server');
        const { getServiceClient } = require('@/lib/supabase/service');
        createServerSupabase.mockResolvedValue(mockServerClient);
        getServiceClient.mockReturnValue(mockServiceClient);
    });

    it('returns true for owner account_type without querying co_owners', async () => {
        mockServerClient.single.mockResolvedValue({
            data: { account_type: 'owner', email: 'owner@example.com' },
        });
        const result = await isOwnerOrCoOwner('owner-uuid');
        expect(result).toBe(true);
        // Service client should NOT be called — owner check short-circuits
        expect(mockServiceClient.from).not.toHaveBeenCalled();
    });

    it('returns true when user_id matches in co_owners', async () => {
        mockServerClient.single.mockResolvedValue({
            data: { account_type: 'candidate', email: 'coowner@example.com' },
        });
        mockServiceClient.maybeSingle.mockResolvedValue({ data: { id: 'co-uuid' } });
        const result = await isOwnerOrCoOwner('co-uuid');
        expect(result).toBe(true);
    });

    it('returns false when not owner and not in co_owners', async () => {
        mockServerClient.single.mockResolvedValue({
            data: { account_type: 'admin', email: 'admin@example.com' },
        });
        mockServiceClient.maybeSingle.mockResolvedValue({ data: null });
        const result = await isOwnerOrCoOwner('admin-uuid');
        expect(result).toBe(false);
    });

    it('returns false when profile is null (deleted user)', async () => {
        mockServerClient.single.mockResolvedValue({ data: null });
        const result = await isOwnerOrCoOwner('ghost-uuid');
        expect(result).toBe(false);
    });
});
```

---

## Step 12 — Build & Verification

```bash
# 1. Type check — must pass 0 errors
npx tsc --noEmit

# 2. Lint changed files
npx eslint \
    src/middleware.ts \
    src/lib/auth/account-type.ts \
    src/app/owner/page.tsx

# 3. Run new test
npx vitest run src/__tests__/api/co-owner-permissions.test.ts

# 4. SQL verification — run in Supabase SQL Editor
```

```sql
-- Confirm all triggers exist
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN (
    'trg_link_co_owner_user_id',
    'trg_link_profile_to_co_owner'
);
-- Expected: 2 rows

-- Confirm co_owners policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'co_owners';
-- Expected: 2 rows

-- Confirm get_my_permissions returns correct data for your account
-- (Run while authenticated as owner in Supabase Auth → SQL with SET LOCAL role)
SELECT * FROM public.get_my_permissions();
-- is_owner should be true, is_admin should be true
```

```bash
# 5. Manual smoke test
# - Sign in as a co-owner account (if one exists in your test environment)
# - Navigate to /owner — should load without redirect to /dashboard
# - Toggle a flag — should succeed
# - Sign in as admin — should NOT be able to reach /owner (redirects to /dashboard)
# - Admin should still be able to POST /api/flags (admin flag toggle path)
```

---

## Done Criteria for Phase 2

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] Co-owner unit test: all 4 cases pass
- [ ] SQL confirms 2 triggers on correct tables
- [ ] SQL confirms 2 RLS policies on `co_owners`
- [ ] Co-owner user can access `/owner` without being redirected
- [ ] Admin user cannot access `/owner` (redirected to `/dashboard`)
- [ ] `get_my_permissions()` returns correct booleans for owner, co-owner, admin, employer accounts
- [ ] Backfill query confirms `user_id` populated on all co-owner rows where user has signed up

**Do not start Phase 3 until all Done Criteria are checked.**
