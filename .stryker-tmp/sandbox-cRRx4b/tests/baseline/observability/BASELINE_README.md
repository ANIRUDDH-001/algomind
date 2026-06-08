# Phase 6 Baseline Snapshot — April 3, 2026

## Summary

Captured baseline observability state before Phase 6 implementation begins. This establishes the before/after evidence required by the Phase 6 gate.

## Artifacts Created

1. **schema-snapshot.json** — System_events table structure, SystemEventPayload interface, and 27 event types enum
   - Current gaps: missing event_version, severity, occurred_at, source fields
   - Logging: fire-and-forget wrapper with no validation or rejection logic

2. **correlation-routes.json** — x-correlation-id header propagation status across critical routes
   - Middleware: already sets correlation ID on response
   - Critical routes missing support: /api/chat, /api/assess/complete, /api/assess/save-progress, /api/admin/events, /api/health
   - Async boundaries without correlation: cron → batch and cron → edge functions

3. **admin-health-shape.json** — Admin health endpoint response shape and event aggregation
   - Returns: models summary, events summary, cron status, system health + alerts
   - Missing: x-correlation-id response header
   - Ready for Phase 6: canonical event type interpretation already in place

4. **owner-analytics-shape.json** — Owner analytics tab event schema usage
   - Uses: hardcoded type string filtering (16 type checks with literals)
   - Risk: brittleness due to string literal duplication and no EventTypes constant usage
   - Refactor target: convert all type checks to EventTypes constant imports

## Coverage Metrics

| Category | Status | Gap |
|----------|--------|-----|
| Event schema version | missing | add event_version='v1' field |
| Severity levels | missing | add severity enum and field |
| Correlation coverage | partial | 2/7 critical routes, async edges missing |
| Wrapper validation | none | add strict schema validation |
| Admin health headers | missing | add x-correlation-id to response |
| Analytics type safety | low | 16 hardcoded literals, no constants |

## Next Steps (P6-2 and beyond)

1. Define strict canonical schema with required/optional field separation
2. Add event_version, severity, occurred_at, source fields
3. Implement wrapper-only event logging with validation
4. Add correlation propagation across sync and async boundaries
5. Align admin health and analytics to canonical event schema
6. Implement sampling and retention policies
7. Run observability simulation and collect evidence for Phase 6 gate

## Baseline Commit

Git tag: `baseline/phase6-observability` (April 3, 2026)
