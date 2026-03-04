# Phase 3 — Auth Redundancy & Tab-Switch Session

> **Prerequisite: Phase 2 Done Criteria must be fully checked before starting.**
> This phase has no DB migrations. All changes are in TypeScript/React files only.
> Focus: eliminate redundant network calls, remove conflicting auth subscriptions,
> and add an 8-hour session validity cache so tab switches never hit the auth server.

---

## What Is Broken & Why

### The Tab-Switch Call Stack (BUG-07 + BUG-08 + BUG-09 + BUG-10 + BUG-11)

A single tab refocus can generate up to **6 network calls to Supabase auth** in rapid succession:

```
Tab regains focus
│
├─ [1] Middleware: getUser() → network call to /auth/v1/user (BUG-07)
│   └─ This fires on every navigation after tab switch
│
├─ [2] Supabase auto-refresh detects near-expiry → TOKEN_REFRESHED event
│   ├─ [3] AuthProvider.onAuthStateChange fires → setState (BUG-08)
│   └─ [4] useSessionPersistence.onAuthStateChange fires → setState again (BUG-08)
│
├─ [5] Manual refreshSession() interval fires (50 min timer) → another TOKEN_REFRESHED (BUG-11)
│   ├─ [6] AuthProvider fires again
│   └─ [7] useSessionPersistence fires again
│
└─ Any admin page mounting useAdmin:
    └─ [8] useAdmin: getUser() → ANOTHER network call (BUG-09)
```

Additionally:
- `useGlobalFeatureFlag` polls `/api/flags` every 30 seconds even when the tab is hidden (BUG-10)
- `AuthProvider` calls `getSession()` (reads localStorage) then registers `onAuthStateChange` which immediately fires `INITIAL_SESSION` — double setState on every page load (BUG-12)

### The Fix Strategy

**Core principle:** The Supabase JWT is valid for 1 hour (confirmed from your settings screenshot — `time-box = never`, standard Supabase 3600s JWT). Supabase JS v2 auto-refreshes tokens ~60s before expiry. We trust this mechanism entirely and remove everything that fights it.

For the 8-hour session goal: the access token expires at 1 hour, but the **refresh token** does not expire (you have `time-box = 0 = never` set). Supabase will silently refresh the access token on any request. We just need to stop re-validating the session on tab switch — instead, we accept the locally stored token as valid until Supabase's own auto-refresh tells us otherwise.

**Session cache mechanism:** We introduce a module-level `lastValidatedAt` timestamp. The middleware skips the `getUser()` network call if the JWT claim shows > 30 minutes remaining AND the token was validated in the last 15 minutes. On actual token refresh (`TOKEN_REFRESHED` event), the timestamp resets.

---

## Step 1 — Create `src/lib/auth/session-cache.ts`

This is the new shared module. All auth consumers import from here instead of duplicating logic.

```typescript
/**
 * session-cache.ts
 *
 * Module-level session validity cache.
 * Prevents redundant getUser() network calls on tab switch, navigation, and mount.
 *
 * Contract:
 * - A session is "trusted" if it was validated within TRUST_WINDOW_MS
 *   AND the JWT expiry is more than MIN_REMAINING_MS away.
 * - On TOKEN_REFRESHED event, call markRefreshed() to reset the window.
 * - On SIGNED_OUT, call clearCache() to invalidate immediately.
 *
 * This does NOT replace Supabase's own auto-refresh (which runs 60s before expiry).
 * It only prevents us from calling getUser() when we already know the session is valid.
 */

/** How long a validated session is trusted without re-checking (15 minutes) */
const TRUST_WINDOW_MS = 15 * 60 * 1000;

/** Minimum JWT time-remaining to consider it valid (5 minutes) */
const MIN_REMAINING_MS = 5 * 60 * 1000;

interface SessionCacheEntry {
    userId: string;
    validatedAt: number;
    expiresAt: number; // JWT exp in ms
}

let _cache: SessionCacheEntry | null = null;

export function markSessionValid(userId: string, jwtExpMs: number): void {
    _cache = {
        userId,
        validatedAt: Date.now(),
        expiresAt: jwtExpMs,
    };
}

export function markRefreshed(userId: string, newJwtExpMs: number): void {
    markSessionValid(userId, newJwtExpMs);
}

export function clearCache(): void {
    _cache = null;
}

/**
 * Returns true if the cached session is still trusted.
 * Call this before making a getUser() network call.
 */
export function isSessionTrusted(): boolean {
    if (!_cache) return false;
    const now = Date.now();
    const withinTrustWindow = now - _cache.validatedAt < TRUST_WINDOW_MS;
    const jwtNotExpiringSoon = _cache.expiresAt - now > MIN_REMAINING_MS;
    return withinTrustWindow && jwtNotExpiringSoon;
}

export function getCachedUserId(): string | null {
    return _cache?.userId ?? null;
}
```

---

## Step 2 — Refactor `src/components/auth/AuthProvider.tsx`

Two issues to fix:
1. **BUG-12:** `getSession()` followed by `onAuthStateChange` fires `INITIAL_SESSION` — double setState
2. **BUG-08:** `useSessionPersistence` has a second `onAuthStateChange` that fires in parallel

Fix: Remove the upfront `getSession()` call and rely solely on `onAuthStateChange`. The `INITIAL_SESSION` event gives you the session immediately on registration — no need to call `getSession()` first. Also integrate the session cache updates here.

**Replace the `initAuth` function inside `AuthProvider.tsx`:**

```typescript
// At the top of the file, add:
import { markSessionValid, markRefreshed, clearCache } from '@/lib/auth/session-cache';
```

Find the `initAuth` async function and replace its entire body:

```typescript
const initAuth = async () => {
    const supabase = getSupabase();
    if (!supabase) {
        if (mounted) setLoading(false);
        return;
    }

    // E2E Test Bypass
    if (
        process.env.NODE_ENV !== 'production' &&
        typeof document !== 'undefined' &&
        document.cookie.includes('playwright-e2e=true')
    ) {
        if (mounted) {
            setSession({} as Session);
            setUser({ id: 'test-user', email: 'test@example.com' } as User);
            setLoading(false);
        }
        return;
    }

    // Register the single auth state listener.
    // INITIAL_SESSION fires immediately with the current session (or null).
    // This replaces the upfront getSession() call — no double-setState.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, newSession: Session | null) => {
            if (!mounted) return;

            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);

            // Update session cache
            if (newSession?.user && newSession.expires_at) {
                const expMs = newSession.expires_at * 1000;
                if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                    markSessionValid(newSession.user.id, expMs);
                }
                if (event === 'TOKEN_REFRESHED') {
                    markRefreshed(newSession.user.id, expMs);
                }
            }

            if (event === 'SIGNED_OUT') {
                clearCache();
            }
        }
    );

    subscriptionCleanup = () => subscription.unsubscribe();
};
```

---

## Step 3 — Gut `src/lib/auth/session-manager.ts`

The `useSessionPersistence` hook currently:
- Registers a second `onAuthStateChange` (duplicate of AuthProvider — BUG-08)
- Manually calls `refreshSession()` every 50 minutes (conflicts with Supabase auto-refresh — BUG-11)

Both must go. Keep only the side-effect of clearing localStorage on sign-out, wired through the AuthProvider's `signOut` method instead.

**Replace the entire file:**

```typescript
'use client';

/**
 * session-manager.ts
 *
 * DEPRECATED BEHAVIORS REMOVED:
 * - Second onAuthStateChange subscription (was firing every auth event twice)
 * - Manual refreshSession() interval (was conflicting with Supabase auto-refresh)
 *
 * localStorage cleanup on SIGNED_OUT is now handled inside AuthProvider.
 * This file is kept as a no-op hook to avoid breaking the import in ClientProviders.
 * It can be deleted once ClientProviders is updated to remove the import.
 */
export function useSessionPersistence(): void {
    // Intentionally empty.
    // AuthProvider handles all session lifecycle events.
}
```

Then update `src/components/auth/AuthProvider.tsx` `signOut` method to clear localStorage:

```typescript
// In the signOut callback inside AuthProvider, add localStorage cleanup:
const signOut = useCallback(async () => {
    if (!isConfigured) return;
    const supabase = getSupabase();
    if (!supabase) return;

    // Clear cached data before signing out
    try {
        localStorage.removeItem('attempted_problems');
        sessionStorage.clear();
    } catch {
        // Storage may not be available
    }

    await supabase.auth.signOut();
    clearCache();
    setUser(null);
    setSession(null);
}, [isConfigured]);
```

Add the `clearCache` import at the top of AuthProvider.tsx (already done in Step 2).

---

## Step 4 — Update `src/middleware.ts` — Smart Validation

The middleware calls `getUser()` (a network call) on every request. Replace with a JWT-decode-first approach: extract the session from cookies, decode the JWT expiry locally, and only call `getUser()` when the token is actually near expiry or when doing a sensitive permission check.

> Note: In Next.js middleware, you cannot use module-level cache (it runs in Edge runtime, stateless). Instead, use the JWT `exp` claim to decide whether to validate.

Find and replace the `getUser()` call section in `src/middleware.ts`:

```typescript
// ADD this import at the top of middleware.ts:
import { jwtDecode } from 'jwt-decode'; // npm install jwt-decode if not present
```

```typescript
// FIND THIS section in middleware (around line 44):
// Refresh session if expired - required for Server Components
const { data: { user } } = await supabase.auth.getUser();
```

```typescript
// REPLACE WITH:
// Smart auth validation: only call getUser() (network) when necessary.
// For tab-switches and navigations where the JWT is still healthy,
// decode it locally and skip the network round-trip.

let user = null;

const accessToken = request.cookies.get(
    `sb-${supabaseUrl.replace('https://', '').replace('.supabase.co', '')}-auth-token`
)?.value;

// Try local JWT decode first to avoid network call
let shouldValidateWithServer = true;

if (accessToken) {
    try {
        // Parse the cookie value — it's a JSON array [access_token, refresh_token]
        const parsed = JSON.parse(accessToken);
        const jwt = Array.isArray(parsed) ? parsed[0] : parsed;
        const decoded = jwtDecode<{ exp: number; sub: string }>(jwt);
        const remainingMs = decoded.exp * 1000 - Date.now();

        // If token has more than 5 minutes remaining, trust it without server call
        if (remainingMs > 5 * 60 * 1000) {
            user = { id: decoded.sub };
            shouldValidateWithServer = false;
        }
    } catch {
        // Decode failed — malformed token, fall through to server validation
    }
}

if (shouldValidateWithServer) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
}
```

> **Important:** After adding this, run `npm install jwt-decode` if not already a dependency. Verify with `cat package.json | grep jwt-decode`.

> **Cookie name caveat:** The Supabase SSR cookie name is derived from the project URL. The pattern `sb-{projectRef}-auth-token` is standard. Verify your actual cookie name in browser DevTools → Application → Cookies after logging in. If it differs, update the `accessToken` lookup accordingly.

---

## Step 5 — Fix `src/hooks/useAdmin.ts` — Use AuthProvider Context

`useAdmin` calls `getUser()` independently, ignoring that `AuthProvider` already has the user. Fix it to consume the context.

**Replace the entire file:**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase/client';

// Module-level cache: stores admin check result per userId
let _adminStatusCache: { isAdmin: boolean; userId: string; expiresAt: number } | null = null;
const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to check if current user is an admin.
 * Consumes AuthProvider context for the user (no extra getUser() call).
 * Caches the check_is_admin() RPC result for 5 minutes.
 */
export function useAdmin() {
    const { user, loading: authLoading } = useAuth(); // ← use context, not getUser()
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return; // Wait for AuthProvider to resolve

        if (!user) {
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        checkAdminStatus(user.id);
    }, [user, authLoading]);

    const checkAdminStatus = async (userId: string) => {
        setLoading(true);
        setError(null);

        // E2E Test Bypass
        if (
            process.env.NODE_ENV !== 'production' &&
            typeof document !== 'undefined' &&
            document.cookie.includes('playwright-e2e=true')
        ) {
            setIsAdmin(true);
            setLoading(false);
            return;
        }

        // Check module-level cache
        const now = Date.now();
        if (
            _adminStatusCache &&
            _adminStatusCache.userId === userId &&
            _adminStatusCache.expiresAt > now
        ) {
            setIsAdmin(_adminStatusCache.isAdmin);
            setLoading(false);
            return;
        }

        try {
            const supabase = getSupabase();
            if (!supabase) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            const { data, error: dbError } = await supabase.rpc('check_is_admin');

            if (dbError) {
                console.warn('Admin check error:', dbError);
                setIsAdmin(false);
            } else {
                const result = !!data;
                setIsAdmin(result);
                _adminStatusCache = {
                    isAdmin: result,
                    userId,
                    expiresAt: Date.now() + ADMIN_CACHE_TTL_MS,
                };
            }
        } catch (err) {
            console.error('Failed to check admin status:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    return { isAdmin, loading: loading || authLoading, error, refetch: () => user && checkAdminStatus(user.id) };
}
```

---

## Step 6 — Fix `src/hooks/useGlobalFeatureFlag.ts` — Visibility Gate

The 30-second polling interval runs even when the tab is hidden. Add a `visibilitychange` gate.

Find the `useEffect` with the `setInterval` in `useGlobalFeatureFlag.ts` and replace it:

```typescript
// FIND THIS:
useEffect(() => {
    refresh();

    // Periodic refresh
    const interval = setInterval(refresh, CACHE_TTL_MS);
    return () => clearInterval(interval);
}, [refresh]);
```

```typescript
// REPLACE WITH:
useEffect(() => {
    refresh();

    // Periodic refresh — only poll when tab is visible
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
        if (interval) return; // already running
        interval = setInterval(() => {
            // Extra guard: skip if tab went hidden between ticks
            if (document.visibilityState === 'visible') {
                refresh();
            }
        }, CACHE_TTL_MS);
    };

    const stopPolling = () => {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            // Tab became visible — refresh immediately then resume polling
            refresh();
            startPolling();
        } else {
            // Tab hidden — stop polling to save API calls
            stopPolling();
        }
    };

    // Only start polling if tab is currently visible
    if (document.visibilityState === 'visible') {
        startPolling();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        stopPolling();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
}, [refresh]);
```

---

## Step 7 — Install `jwt-decode` if Missing

```bash
# Check if already installed
cat package.json | grep jwt-decode

# If missing:
npm install jwt-decode

# Verify types are available
npx tsc --noEmit 2>&1 | grep jwt-decode
# Should show nothing (no errors)
```

---

## Step 8 — Update Tests

### 8a. Update `useAdmin` test

Open `src/hooks/__tests__/useAdmin.test.ts`. Update the mock setup to reflect the new context dependency:

```typescript
// Add to imports
import { useAuth } from '@/components/auth/AuthProvider';

// Add mock
vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn(),
}));

// In beforeEach, set default:
beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
        user: { id: 'test-user-123', email: 'test@example.com' },
        loading: false,
        // ... other fields as needed
    } as any);
});

// Test: no extra getUser() call is made
it('does not call supabase.auth.getUser() independently', async () => {
    // useAdmin should get user from useAuth, not from supabase.auth.getUser()
    // The mock supabase should not have getUser called
    render(<TestComponent />);
    await waitFor(() => {
        expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    });
});
```

### 8b. Update `useSessionPersistence` test

Open `src/hooks/__tests__/useSessionPersistence.test.ts`. The hook is now a no-op. Update accordingly:

```typescript
it('renders without errors (no-op implementation)', () => {
    // useSessionPersistence is now intentionally empty
    // All session management is handled by AuthProvider
    expect(() => renderHook(() => useSessionPersistence())).not.toThrow();
});

it('does not register onAuthStateChange listeners', () => {
    const mockSupabase = getSupabase() as any;
    renderHook(() => useSessionPersistence());
    expect(mockSupabase.auth.onAuthStateChange).not.toHaveBeenCalled();
});
```

### 8c. Add session cache unit test

Create `src/__tests__/auth/session-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { markSessionValid, clearCache, isSessionTrusted, getCachedUserId, markRefreshed } from '@/lib/auth/session-cache';

describe('session-cache', () => {
    beforeEach(() => {
        clearCache();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        clearCache();
    });

    it('returns false when cache is empty', () => {
        expect(isSessionTrusted()).toBe(false);
        expect(getCachedUserId()).toBeNull();
    });

    it('returns true immediately after markSessionValid with valid exp', () => {
        const expMs = Date.now() + 60 * 60 * 1000; // 1 hour from now
        markSessionValid('user-123', expMs);
        expect(isSessionTrusted()).toBe(true);
        expect(getCachedUserId()).toBe('user-123');
    });

    it('returns false after trust window expires (15 minutes)', () => {
        const expMs = Date.now() + 60 * 60 * 1000; // 1 hour from now
        markSessionValid('user-123', expMs);
        expect(isSessionTrusted()).toBe(true);

        // Advance time by 16 minutes
        vi.advanceTimersByTime(16 * 60 * 1000);
        expect(isSessionTrusted()).toBe(false);
    });

    it('returns false when JWT expires within 5 minutes', () => {
        const expMs = Date.now() + 3 * 60 * 1000; // expires in 3 minutes (below MIN_REMAINING)
        markSessionValid('user-123', expMs);
        expect(isSessionTrusted()).toBe(false);
    });

    it('returns false after clearCache()', () => {
        markSessionValid('user-123', Date.now() + 3600000);
        expect(isSessionTrusted()).toBe(true);
        clearCache();
        expect(isSessionTrusted()).toBe(false);
    });

    it('markRefreshed resets the trust window', () => {
        const initialExp = Date.now() + 3600000;
        markSessionValid('user-123', initialExp);

        // Advance 14 minutes (still within 15-min window)
        vi.advanceTimersByTime(14 * 60 * 1000);
        expect(isSessionTrusted()).toBe(true);

        // Advance 2 more minutes (now at 16 min — would be expired)
        // But if markRefreshed was called at 14 min, window resets
        const newExp = Date.now() + 3600000;
        markRefreshed('user-123', newExp);
        vi.advanceTimersByTime(2 * 60 * 1000);
        expect(isSessionTrusted()).toBe(true); // window reset at 14min mark
    });
});
```

---

## Step 9 — Build & Verification

```bash
# 1. Install new dep if needed
npm install jwt-decode

# 2. Type check — 0 errors required
npx tsc --noEmit

# 3. Lint changed files
npx eslint \
    src/lib/auth/session-cache.ts \
    src/lib/auth/session-manager.ts \
    src/middleware.ts \
    src/hooks/useAdmin.ts \
    src/hooks/useGlobalFeatureFlag.ts \
    src/components/auth/AuthProvider.tsx

# 4. Unit tests
npx vitest run \
    src/__tests__/auth/session-cache.test.ts \
    src/hooks/__tests__/useAdmin.test.ts \
    src/hooks/__tests__/useSessionPersistence.test.ts \
    src/hooks/__tests__/useFeatureFlag.test.ts

# 5. Build check (catches tree-shaking / import issues)
npm run build
```

### Manual Verification — Auth Call Count

Open browser DevTools → Network tab. Filter by `supabase.co`.

**Before Phase 3 (baseline to compare against):**
- Expected: multiple `/auth/v1/user` calls on tab switch

**After Phase 3:**
1. Log in fresh
2. Open Network tab, clear it
3. Switch to another browser tab for 30 seconds
4. Switch back
5. Click a navigation link (e.g., Dashboard → Settings)

**Expected network calls to `supabase.co`:**
- `/auth/v1/user` → **0 calls** (JWT decoded locally, token not near expiry)
- `/api/flags` → **0 calls** (visibility gate, tab was hidden)
- Any DB queries (data fetches) → normal, expected

**If JWT is near expiry (< 5 min remaining):**
- `/auth/v1/token` → 1 call (Supabase auto-refresh, expected)
- `/auth/v1/user` → 0 calls still (we trust the new token from refresh event)

### Manual Verification — Feature Flag Polling

1. Open DevTools Network, filter by `/api/flags`
2. Switch tab away, wait 2 minutes
3. Switch back

**Expected:** 0 `/api/flags` calls while tab was hidden. Exactly 1 call on tab-return (visibility refresh).

---

## Done Criteria for Phase 3

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npm run build` succeeds
- [ ] `session-cache` unit tests: all 6 cases pass
- [ ] `useAdmin` test: confirms no independent `getUser()` call
- [ ] `useSessionPersistence` test: confirms no `onAuthStateChange` registered
- [ ] Network DevTools: 0 `/auth/v1/user` calls on tab switch with healthy JWT
- [ ] Network DevTools: 0 `/api/flags` calls while tab is hidden
- [ ] No visible regression on login, logout, and protected route redirect

---

## Summary: What All Three Phases Achieve Together

| Before | After |
|---|---|
| Flag toggles silently fail or hit stale Redis | Writes go through service role + upsert + correct Redis bust |
| Co-owners get 403 trying to verify themselves | Co-owner RLS allows self-read; isOwnerOrCoOwner uses service client |
| 4 different "is admin?" code paths | Single `isOwnerOrCoOwner()` utility, consistent everywhere |
| 4–6 auth network calls on tab switch | 0–1 auth network calls (JWT decoded locally, Supabase handles auto-refresh) |
| `useGlobalFeatureFlag` polls background tabs | Polling pauses on tab hide, resumes on tab visible |
| Double `onAuthStateChange` causing double re-renders | Single subscription in AuthProvider only |
| Manual 50-min refresh fighting Supabase auto-refresh | Removed; Supabase handles it natively |
| `useAdmin` makes independent `getUser()` call | Uses AuthProvider context directly |
