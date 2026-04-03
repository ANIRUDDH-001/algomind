import { describe, it, expect } from 'vitest';
import {
    EventTypes,
    EventSeverity,
    validateEventPayload,
    normalizeEventPayload,
    StrictSystemEventPayload,
    SystemEventPayload,
} from '../events';

/**
 * P6-4: Event Taxonomy Contract Tests
 *
 * Validates:
 * 1. All EventTypes constants map to valid severity/domain combinations
 * 2. normalizeEventPayload() correctly converts legacy aliases without data loss
 * 3. Validation rejects unknown type, unknown severity, malformed metadata
 * 4. event_version='v1' is always present on output
 * 5. Wrapper ensures correlation_id presence
 * 6. Canonical vs legacy type mapping is bidirectional
 */

describe('Event Taxonomy Contract Tests (P6-4)', () => {
    describe('EventTypes constant coverage', () => {
        it('should have canonical domain.type entries for all core event types (minimum 38)', () => {
            const canonicalEntries = Object.entries(EventTypes)
                .filter(([_, meta]) => (meta as any).canonical === true)
                .map(([type]) => type);

            expect(canonicalEntries.length).toBeGreaterThanOrEqual(38);
            expect(canonicalEntries).toContain('ai.model_error');
            expect(canonicalEntries).toContain('db.error');
            expect(canonicalEntries).toContain('cron.failed');
            expect(canonicalEntries).toContain('batch.completed');
        });

        it('should have legacy underscored aliases for backward compat (minimum 28)', () => {
            const legacyEntries = Object.entries(EventTypes)
                .filter(([_, meta]) => (meta as any).canonical === false)
                .map(([type]) => type);

            expect(legacyEntries.length).toBeGreaterThanOrEqual(28);
            expect(legacyEntries).toContain('model_error');
            expect(legacyEntries).toContain('db_error');
            expect(legacyEntries).toContain('cron_failed');
            expect(legacyEntries).toContain('batch_job_complete');
        });

        it('should map both canonical and legacy names to same severity', () => {
            const canonicalSeverity = EventTypes['ai.model_error'].severity;
            const legacySeverity = EventTypes['model_error'].severity;
            expect(canonicalSeverity).toBe(legacySeverity);
            expect(canonicalSeverity).toBe(EventSeverity.ERROR);
        });

        it('should cover ERROR and WARN severity levels used by event types', () => {
            const uniqueSeverities = new Set(
                Object.values(EventTypes).map((e: any) => e.severity)
            );

            expect(uniqueSeverities).toContain(EventSeverity.ERROR);
            expect(uniqueSeverities).toContain(EventSeverity.WARN);
            expect(uniqueSeverities).toContain(EventSeverity.INFO);
            expect(uniqueSeverities).toContain(EventSeverity.DEBUG);
        });
    });

    describe('Payload Normalization', () => {
        it('should normalize legacy camelCase to snake_case', () => {
            const legacy: SystemEventPayload = {
                type: 'model_error',
                userId: 'user-123',
                sessionId: 'sess-456',
                correlationId: 'corr-789',
                errorCode: 'ERR_TIMEOUT',
                errorMessage: 'Timeout',
            };

            const normalized = normalizeEventPayload(legacy);
            expect(normalized).not.toBeNull();
            expect(normalized!.user_id).toBe('user-123');
            expect(normalized!.session_id).toBe('sess-456');
            expect(normalized!.correlation_id).toBe('corr-789');
        });

        it('should preserve snake_case if provided', () => {
            const payload: SystemEventPayload = {
                type: 'db_error',
                user_id: 'user-123',
                session_id: 'sess-456',
                correlation_id: 'corr-789',
            };

            const normalized = normalizeEventPayload(payload);
            expect(normalized!.user_id).toBe('user-123');
            expect(normalized!.session_id).toBe('sess-456');
            expect(normalized!.correlation_id).toBe('corr-789');
        });

        it('should generate UUID if correlation_id is missing', () => {
            const payload: SystemEventPayload = {
                type: 'model_error',
            };

            const normalized = normalizeEventPayload(payload);
            expect(normalized!.correlation_id).toBeDefined();
            expect(normalized!.correlation_id.length).toBe(36); // UUID v4 format
        });

        it('should set event_version=v1 on normalized payload', () => {
            const payload: SystemEventPayload = {
                type: 'route_error',
            };

            const normalized = normalizeEventPayload(payload);
            expect(normalized!.event_version).toBe('v1');
        });

        it('should map correct severity from EventTypes', () => {
            const errorPayload: SystemEventPayload = {
                type: 'db_error',
            };

            const warnPayload: SystemEventPayload = {
                type: 'model_429',
            };

            const normalizedError = normalizeEventPayload(errorPayload);
            const normalizedWarn = normalizeEventPayload(warnPayload);

            expect(normalizedError!.severity).toBe(EventSeverity.ERROR);
            expect(normalizedWarn!.severity).toBe(EventSeverity.WARN);
        });

        it('should return null for unknown event type', () => {
            const invalidPayload = {
                type: 'unknown_event_type_xyz',
            } as unknown as SystemEventPayload;

            const normalized = normalizeEventPayload(invalidPayload);
            expect(normalized).toBeNull();
        });
    });

    describe('Payload Validation', () => {
        it('should reject non-object payloads', () => {
            const result = validateEventPayload(null);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('must be a non-null object');

            const result2 = validateEventPayload('string');
            expect(result2.valid).toBe(false);
        });

        it('should reject missing or invalid type', () => {
            const result = validateEventPayload({
                event_version: 'v1',
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('type is required');
        });

        it('should reject unknown event type', () => {
            const result = validateEventPayload({
                type: 'unknown_event',
                event_version: 'v1',
                severity: EventSeverity.INFO,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Unknown event type');
        });

        it('should reject invalid event_version', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v2',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('event_version must be');
        });

        it('should reject unknown severity', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: 'critical' as EventSeverity,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('severity must be one of');
        });

        it('should reject non-ISO occurred_at', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: '2026-04-03 12:00:00',
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('occurred_at must be ISO timestamp');
        });

        it('should reject missing or empty correlation_id', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: '',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('correlation_id is required');
        });

        it('should reject invalid source', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'unknown' as any,
                metadata: { component: 'test', operation: 'test', environment: 'development' },
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('source must be one of');
        });

        it('should reject missing metadata', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('metadata is required');
        });

        it('should reject missing metadata.component', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { operation: 'test', environment: 'development' } as any,
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('component is required');
        });

        it('should reject invalid metadata.environment', () => {
            const result = validateEventPayload({
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                metadata: { component: 'test', operation: 'test', environment: 'unknown' } as any,
            });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('environment must be one of');
        });

        it('should accept valid strict payload', () => {
            const validPayload: StrictSystemEventPayload = {
                type: 'ai.model_error',
                event_version: 'v1',
                severity: EventSeverity.ERROR,
                occurred_at: new Date().toISOString(),
                correlation_id: 'test-corr-id',
                source: 'http',
                error_code: 'TIMEOUT',
                error_message: 'Model request timed out',
                metadata: {
                    component: 'ai.client',
                    operation: 'fetch_model_response',
                    environment: 'production',
                    duration_ms: 5000,
                    extra: { model_id: 'gpt-4' },
                },
            };

            const result = validateEventPayload(validPayload);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
        });
    });

    describe('Legacy to Canonical Type Mapping', () => {
        it('should establish bidirectional mapping for AI domain', () => {
            expect(EventTypes['ai.model_error']).toBeDefined();
            expect(EventTypes['model_error']).toBeDefined();
            expect(EventTypes['ai.model_error'].severity).toBe(EventTypes['model_error'].severity);
        });

        it('should establish bidirectional mapping for Cron domain', () => {
            expect(EventTypes['cron.failed']).toBeDefined();
            expect(EventTypes['cron_failed']).toBeDefined();
            expect(EventTypes['cron.failed'].severity).toBe(EventTypes['cron_failed'].severity);
        });

        it('should establish bidirectional mapping for Database domain', () => {
            expect(EventTypes['db.error']).toBeDefined();
            expect(EventTypes['db_error']).toBeDefined();
            expect(EventTypes['db.error'].severity).toBe(EventTypes['db_error'].severity);
        });
    });

    describe('Deprecation and Future-Proofing', () => {
        it('should support telemetry events for observability validation', () => {
            expect(EventTypes['telemetry.event_validation_failed']).toBeDefined();
            expect(EventTypes['telemetry.sampling_drop']).toBeDefined();
            expect(EventTypes['telemetry.retention_completed']).toBeDefined();
        });

        it('should support edge function events for review-reminders', () => {
            expect(EventTypes['edge.review_reminders_queued']).toBeDefined();
            expect(EventTypes['edge.review_reminders_failed']).toBeDefined();
        });
    });
});
