# CODESAGE AUDIT PLAN
Generated: 2026-06-01
Codebase: algomind
Tier: C | Total source files: 828

## Sections
| ID | Name | Files | Phase |
|----|------|-------|-------|
| SEC-01 | Root Config & Scripts | /*.json, /*.ts, /*.mjs, /*.js, /scripts/* | Phase 2 |
| SEC-02 | Core Libs: API & Assessment | src/lib/api/*, src/lib/assessment/*, src/lib/assess/* | Phase 2 |
| SEC-03 | Core Libs: AI & Knowledge | src/lib/ai/*, src/lib/kai-context/*, src/lib/knowledge-graph/*, src/lib/rag/* | Phase 3 |
| SEC-04 | Core Libs: DB, Cache & Analytics | src/lib/supabase/*, src/lib/upstash/*, src/lib/cache/*, src/lib/analytics/*, src/lib/telemetry/* | Phase 3 |
| SEC-05 | Core Libs: Interview & Voice | src/lib/interview/*, src/lib/voice/*, src/lib/aws/* | Phase 4 |
| SEC-06 | Other Libs & Hooks | src/lib/* (remaining), src/hooks/* | Phase 4 |
| SEC-07 | App Routes: Core APIs | src/app/api/* | Phase 5 |
| SEC-08 | App Routes: Pages | src/app/* (excluding api) | Phase 5 |
| SEC-09 | UI Components: Dashboard & Interview | src/components/dashboard/*, src/components/interview/*, src/components/voice/* | Phase 6 |
| SEC-10 | UI Components: Core & Layout | src/components/ui/*, src/components/layout/* | Phase 6 |
| SEC-11 | UI Components: Others | src/components/* (remaining) | Phase 6 |

## Phase Schedule
- Phase 2: Sections SEC-01, SEC-02 (Root config, API & Assessment logic)
- Phase 3: Sections SEC-03, SEC-04 (AI, Knowledge, Database, and Cache)
- Phase 4: Sections SEC-05, SEC-06 (Interview flow, Voice, Hooks, and other Libs)
- Phase 5: Sections SEC-07, SEC-08 (Next.js Application Routes & API Endpoints)
- Phase 6: Sections SEC-09, SEC-10, SEC-11 (React Frontend Components)
- Phase 7: Multi-domain analysis (all sections complete)
- Phase 8: Synthesis and audit report

## Skipped (binary/generated/assets):
[node_modules, .git, dist, build, __pycache__, .next, venv, .venv, playwright-report, test-results, public, .playwright, supabase, tests]
