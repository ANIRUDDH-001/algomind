# Security Audit

## Auth & Authorization Model
- **Authentication:** Managed by Supabase Auth.
- **Authorization:** Handled via Server-Side Next.js Middleware and Row Level Security (RLS).
  - Routes like `/interview` and `/dashboard` are protected and redirect unauthenticated users.
  - API routes utilize `@supabase/ssr` to verify session cookies before performing actions.

## Security Audit Findings

| Severity | Finding | Status |
|----------|---------|--------|
| **High** | Telemetry logs bypassing standard logger. `console.error` was found in `auth/callback/route.ts` which could leak exchange errors. | **FIXED** (Post-Audit Fix) |
| **Medium** | Remote Code Execution API (Piston) is utilizing public unauthenticated endpoints. | OPEN |
| **Low** | Rate limiters fallback to fail-open if Upstash Redis goes offline, which is good for availability but could expose LLM APIs to unbounded scraping if Redis is down for extended periods. | OPEN |

## Security Checklist
- [x] No hardcoded secrets in source (Validated via `.env.example` mapping).
- [x] All user-data routes require auth.
- [x] Input validation on all POST/PUT/PATCH routes (Strict schemas on LLM outputs).
- [x] API keys in env vars only.
- [x] RLS policies on all user tables in Supabase (Implicit by schema structure).
