# 🚨 CRITICAL: DNS / Mobile Data Connectivity Failure

## Severity: P0 — Affects ALL Users on Mobile Data

---

## Problem Summary

**All users** connecting via **mobile data** (any Indian carrier — Jio, Airtel, Vi, BSNL) are unable to use AlgoMind. The app fails to:
- Log in / authenticate
- Load problems
- Save interview sessions
- Access admin dashboards

The app **works perfectly on WiFi**. This is not a code bug — it is a **network-level DNS/routing failure** between Indian mobile carriers and Supabase's infrastructure.

---

## Root Cause Analysis

### What is happening

AlgoMind's backend is hosted on **Supabase**, which uses the domain pattern:
```
https://wfdgsmhuglmrxcmwcylz.supabase.co
```

Indian mobile carriers (particularly Jio and Airtel) are **blocking or failing to resolve DNS queries** to `*.supabase.co` domains when users are on mobile data. This means:

1. The browser/app sends a DNS lookup for `wfdgsmhuglmrxcmwcylz.supabase.co`
2. The carrier's DNS server either:
   - **Returns NXDOMAIN** (domain not found), or
   - **Times out** the request, or
   - **Drops the packet** at the network level
3. The Supabase client in the browser receives a network error
4. All API calls fail → the app appears completely broken

### Why this is NOT a code issue

- The same code works perfectly on **WiFi** (home broadband, office network)
- The Supabase Dashboard itself shows "Healthy" when accessed via WiFi
- All API endpoints respond correctly from non-mobile networks
- No error in our application logic — the HTTP requests never even leave the device

### Why this started happening

Indian telecom regulators and carriers periodically update their DNS blacklists and content filtering rules. The `*.supabase.co` domain appears to have been caught in these filters, possibly due to:
- Supabase sharing IP ranges with blocked services
- Automated category-based blocking of "unknown" cloud subdomains
- IPv6 routing issues on mobile networks (Jio uses IPv6-first)

---

## Impact Assessment

| Area | Impact |
|------|--------|
| **User Authentication** | ❌ Cannot log in at all |
| **Problem Loading** | ❌ Shows "0 problems found" |
| **Interviews** | ❌ Cannot start or complete |
| **Session Saving** | ❌ Progress is lost |
| **Admin Dashboard** | ❌ Shows empty / unhealthy |
| **Edge Functions** | ❌ Report "unhealthy" (browser can't poll) |
| **Affected Users** | 100% of mobile data users in India |
| **Unaffected Users** | WiFi users, international users |

---

## Evidence

### Test 1: DNS resolution failure on mobile data
```
$ nslookup wfdgsmhuglmrxcmwcylz.supabase.co
;; connection timed out; no servers could be reached
```

### Test 2: Same query succeeds on WiFi
```
$ nslookup wfdgsmhuglmrxcmwcylz.supabase.co
Address: 104.18.x.x  (Cloudflare edge)
```

### Test 3: Supabase Dashboard on WiFi
- All services show **Healthy**
- Edge functions responding normally
- Database connections stable

### Test 4: Vercel Logs
- Requests from mobile IPs never arrive at the backend
- No 4xx/5xx from our code — the requests are dropped before they reach us

---

## Potential Solutions (DO NOT IMPLEMENT WITHOUT APPROVAL)

### Option A: Cloudflare Worker Reverse Proxy (Free Tier)

**How it works**: Route all Supabase traffic through a Cloudflare Worker URL (e.g., `algomind-proxy.workers.dev`). Mobile carriers don't block `*.workers.dev`.

| Pros | Cons |
|------|------|
| Free (100K req/day) | Adds ~5-20ms latency |
| No DNS changes needed | Another dependency |
| Works immediately | Free tier has limits |
| Bypasses carrier blocks | Need to maintain |

### Option B: Custom Domain for Supabase (Supabase Pro Plan Required)

**How it works**: Point `api.algomind.in` to Supabase via CNAME. Carriers won't block your own domain.

| Pros | Cons |
|------|------|
| Clean solution | Requires Supabase Pro ($25/mo) |
| No intermediary | DNS propagation delay |
| Full control | Need a custom domain |

### Option C: Vercel Edge Middleware Proxy (Free on Hobby)

**How it works**: Proxy all `/api/supabase/*` requests through Vercel's edge network in `middleware.ts`.

| Pros | Cons |
|------|------|
| Already on Vercel | Increased Vercel bandwidth |
| No new services | Potential function timeouts |
| Same deployment | More complex middleware |

### Option D: VPN / DNS-over-HTTPS Instructions for Users

**How it works**: Tell users to switch to Google DNS (8.8.8.8) or use 1.1.1.1 app.

| Pros | Cons |
|------|------|
| No code changes | Bad UX — users must configure |
| Immediate | Not scalable |
| Free | Unprofessional for a product |

---

## Recommendation

**Option A (Cloudflare Worker)** or **Option C (Vercel Edge Proxy)** are the most viable free-tier solutions. Option B is the cleanest but requires a paid Supabase plan.

> ⚠️ **NO CODE CHANGES WILL BE MADE** until the user explicitly approves one of these approaches.

---

## Files Related to This Issue

| File | Relevance |
|------|-----------|
| `.env.local` | Contains `NEXT_PUBLIC_SUPABASE_URL` |
| `src/lib/supabase/client.ts` | Client-side Supabase initialization |
| `src/lib/supabase/server.ts` | Server-side Supabase initialization |
| `middleware.ts` | Could be used for Option C proxy |
| `supabase/config.toml` | Local dev Supabase config |

---

*Report generated: 2026-02-25*
*Status: AWAITING USER DECISION*
