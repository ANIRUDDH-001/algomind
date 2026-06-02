# Security Audit

## Authentication & Authorization
- Supabase Auth handles identity.
- RLS policies restrict table access.
- Upstash handles rate limiting.

## Findings
- Low: Public Piston execution endpoint needs rate limiting or self-hosting.
- All critical env vars are handled correctly.
