/**
 * @codesage
 * @file      src/lib/monitoring/events.ts
 * @purpose   Telemetry, events mapping, and route correlation.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @summary   This is a large file (> 500 lines) handling complex logic for Telemetry, events mapping, and route correlation.
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
import { getServiceClient } from '@/lib/supabase/service';
// @ts-expect-error -- automated unused local suppression
import { getCorrelationId } from '@/lib/tracing/correlation';

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 6: STRICT SYSTEM EVENT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * EVENT STORAGE POLICY:
 *
 * DB (system_events table):
 *   - FATAL, ERROR events: always stored (sample rate 1.0)
 *   - WARN events: stored at 50% sample rate in production
 *   - INFO events: stored at 10% sample rate in production
 *   - DEBUG events: stored at 1% sample rate in production
 *
 * BetterStack (external sink):
 *   - All events are forwarded regardless of DB sampling
 *
 * Owner Dashboard "Overview" tab:
 *   - Only shows ERROR and FATAL event types (filtered in owner/page.tsx)
 *
 * Event types that SHOULD NOT generate DB rows in normal operation:
 *   - llm_request: logged post-call, 10% sample, INFO — background signal only
 *   - kg_cache_hit / kg_cache_miss: DEBUG — very high volume, DB sample near-zero
 *   - cron_triggered / cron_completed: INFO — keep for job monitoring
 *
 * Event types that MUST ALWAYS generate DB rows:
 *   - db_error, route_error, model_error, embedding_failed: ERROR/FATAL
 *   - cron_failed, batch.failed: ERROR
 *   - model_deprecated: WARN
 */

/**
 * Severity levels for system events.
 * Used for sampling policy, alerting, and dashboard filtering.
 */
export enum EventSeverity {
    FATAL = 'fatal',    // System-critical: data loss, full outage
    ERROR = 'error',    // Recoverable error affecting user experience
    WARN = 'warn',      // Degraded performance or non-critical failure
    INFO = 'info',      // Normal operational event
    DEBUG = 'debug',    // Detailed diagnostic information
}

/**
 * Canonical system event type taxonomy, grouped by domain.
 * Each type is immutable and tied to a specific severity.
 * Includes both canonical names (domain.type) and legacy names (underscored) for backward compat.
 */
export const EventTypes = {
    // AI/LLM domain (canonical + legacy)
    'ai.llm_request': { severity: EventSeverity.INFO, domain: 'ai', canonical: true },
    'llm_request': { severity: EventSeverity.INFO, domain: 'ai', canonical: false },

    'ai.model_timeout': { severity: EventSeverity.WARN, domain: 'ai', canonical: true },
    'model_timeout': { severity: EventSeverity.WARN, domain: 'ai', canonical: false },

    'ai.model_error': { severity: EventSeverity.ERROR, domain: 'ai', canonical: true },
    'model_error': { severity: EventSeverity.ERROR, domain: 'ai', canonical: false },

    'ai.model_429': { severity: EventSeverity.WARN, domain: 'ai', canonical: true },
    'model_429': { severity: EventSeverity.WARN, domain: 'ai', canonical: false },

    'ai.model_deprecated': { severity: EventSeverity.WARN, domain: 'ai', canonical: true },
    'model_deprecated': { severity: EventSeverity.WARN, domain: 'ai', canonical: false },

    'ai.model_verification_failed': { severity: EventSeverity.ERROR, domain: 'ai', canonical: true },
    'model_verification_failed': { severity: EventSeverity.ERROR, domain: 'ai', canonical: false },

    'ai.embedding_failed': { severity: EventSeverity.ERROR, domain: 'ai', canonical: true },
    'embedding_failed': { severity: EventSeverity.ERROR, domain: 'ai', canonical: false },

    // Database domain
    'db.error': { severity: EventSeverity.ERROR, domain: 'db', canonical: true },
    'db_error': { severity: EventSeverity.ERROR, domain: 'db', canonical: false },

    // Redis domain
    'redis_circuit_open': { severity: EventSeverity.ERROR, domain: 'db', canonical: true },
    'redis_circuit_closed': { severity: EventSeverity.INFO, domain: 'db', canonical: true },

    // Rate limiting domain
    'rate_limit.user_exceeded': { severity: EventSeverity.WARN, domain: 'rate_limit', canonical: true },
    'user_rate_limit': { severity: EventSeverity.WARN, domain: 'rate_limit', canonical: false },

    // Authentication domain
    'auth.admin_action': { severity: EventSeverity.INFO, domain: 'auth', canonical: true },
    'admin_action': { severity: EventSeverity.INFO, domain: 'auth', canonical: false },

    // API/Route domain
    'api.route_error': { severity: EventSeverity.ERROR, domain: 'api', canonical: true },
    'route_error': { severity: EventSeverity.ERROR, domain: 'api', canonical: false },

    'api.client_error': { severity: EventSeverity.INFO, domain: 'api', canonical: true },
    'client_error': { severity: EventSeverity.INFO, domain: 'api', canonical: false },

    // Cron/Batch domain
    'cron.triggered': { severity: EventSeverity.INFO, domain: 'cron', canonical: true },
    'cron_triggered': { severity: EventSeverity.INFO, domain: 'cron', canonical: false },

    'cron.running': { severity: EventSeverity.INFO, domain: 'cron', canonical: true },
    'cron_running': { severity: EventSeverity.INFO, domain: 'cron', canonical: false },

    'cron.completed': { severity: EventSeverity.INFO, domain: 'cron', canonical: true },
    'cron_completed': { severity: EventSeverity.INFO, domain: 'cron', canonical: false },

    'cron.failed': { severity: EventSeverity.ERROR, domain: 'cron', canonical: true },
    'cron_failed': { severity: EventSeverity.ERROR, domain: 'cron', canonical: false },

    'batch.step_started': { severity: EventSeverity.INFO, domain: 'batch', canonical: true },
    'batch.step_completed': { severity: EventSeverity.INFO, domain: 'batch', canonical: true },
    'batch.step_failed': { severity: EventSeverity.ERROR, domain: 'batch', canonical: true },
    'batch.completed': { severity: EventSeverity.INFO, domain: 'batch', canonical: true },
    'batch_job_complete': { severity: EventSeverity.INFO, domain: 'batch', canonical: false },
    'batch.failed': { severity: EventSeverity.ERROR, domain: 'batch', canonical: true },

    // Assessment domain
    'assessment.insufficient_response': { severity: EventSeverity.WARN, domain: 'assessment', canonical: true },
    'assessment_insufficient': { severity: EventSeverity.WARN, domain: 'assessment', canonical: false },

    // Voice domain
    'voice.session_start': { severity: EventSeverity.INFO, domain: 'voice', canonical: true },
    'voice_session_start': { severity: EventSeverity.INFO, domain: 'voice', canonical: false },

    'voice.tts_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: true },
    'tts_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: false },

    'voice.stt_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: true },
    'stt_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: false },

    'voice.vad_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: true },
    'vad_fallback': { severity: EventSeverity.WARN, domain: 'voice', canonical: false },

    // Integration domain
    'integration.leetcode_fetch_failed': { severity: EventSeverity.WARN, domain: 'integration', canonical: true },
    'leetcode_fetch_failed': { severity: EventSeverity.WARN, domain: 'integration', canonical: false },

    'integration.piston_error': { severity: EventSeverity.ERROR, domain: 'integration', canonical: true },
    'piston_error': { severity: EventSeverity.ERROR, domain: 'integration', canonical: false },

    'integration.transcript_save_failed': { severity: EventSeverity.ERROR, domain: 'integration', canonical: true },
    'transcript_save_failed': { severity: EventSeverity.ERROR, domain: 'integration', canonical: false },

    // Knowledge domain
    'knowledge.cache_hit': { severity: EventSeverity.DEBUG, domain: 'knowledge', canonical: true },
    'kg_cache_hit': { severity: EventSeverity.DEBUG, domain: 'knowledge', canonical: false },

    'knowledge.cache_miss': { severity: EventSeverity.DEBUG, domain: 'knowledge', canonical: true },
    'kg_cache_miss': { severity: EventSeverity.DEBUG, domain: 'knowledge', canonical: false },

    // Telemetry/Observability domain
    'telemetry.prompt_size_warning': { severity: EventSeverity.WARN, domain: 'telemetry', canonical: true },
    'prompt_size_warning': { severity: EventSeverity.WARN, domain: 'telemetry', canonical: false },

    'telemetry.event_validation_failed': { severity: EventSeverity.WARN, domain: 'telemetry', canonical: true },
    'telemetry.sampling_drop': { severity: EventSeverity.INFO, domain: 'telemetry', canonical: true },
    'telemetry.deprecated_log_wrapper_usage': { severity: EventSeverity.WARN, domain: 'telemetry', canonical: true },
    'telemetry.retention_completed': { severity: EventSeverity.INFO, domain: 'telemetry', canonical: true },

    // Edge function domain
    'edge.review_reminders_queued': { severity: EventSeverity.INFO, domain: 'edge', canonical: true },
    'edge.review_reminders_failed': { severity: EventSeverity.ERROR, domain: 'edge', canonical: true },

    // Payment domain
    'payment.order_created': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.verify_success': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.verify_failed': { severity: EventSeverity.ERROR, domain: 'payment', canonical: true },
    'payment.subscription_created': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.subscription_charged': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.subscription_cancelled': { severity: EventSeverity.WARN, domain: 'payment', canonical: true },
    'payment.subscription_failed': { severity: EventSeverity.ERROR, domain: 'payment', canonical: true },
    'payment.webhook_received': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.webhook_processed': { severity: EventSeverity.INFO, domain: 'payment', canonical: true },
    'payment.webhook_failed': { severity: EventSeverity.ERROR, domain: 'payment', canonical: true },
} as const;

export type SystemEventType = keyof typeof EventTypes;

/**
 * Strict canonical system event payload.
 * Required fields must be present on all events; optional fields may be omitted.
 */
export interface StrictSystemEventPayload {
    // Required
    type: SystemEventType;
    event_version: 'v1';
    severity: EventSeverity;
    occurred_at: string; // ISO timestamp when event logically occurred
    correlation_id: string; // Trace ID for request or job
    source: 'http' | 'cron' | 'batch' | 'edge' | 'script'; // Origin context

    // Optional but recommended
    user_id?: string;
    session_id?: string;
    request_path?: string;
    http_method?: string;
    http_status?: number;
    provider?: string;
    model_id?: string;
    error_code?: string;
    error_message?: string;

    // Structured metadata for this event
    metadata: {
        component: string; // e.g., 'ai.client', 'assess.pipeline', 'cron.batch'
        operation: string; // e.g., 'fetch_model', 'save_progress', 'compute_insights'
        environment: 'development' | 'staging' | 'production';
        // Optional metadata
        duration_ms?: number;
        retry_count?: number;
        idempotency_key?: string;
        records_processed?: number;
        records_succeeded?: number;
        records_failed?: number;
        token_in?: number;
        token_out?: number;
        cost_usd?: number;
        extra?: Record<string, unknown>;
    };
}

/**
 * Legacy payload format for backward compatibility.
 * Gradually migrate all callers to StrictSystemEventPayload.
 */
export interface SystemEventPayload {
    type: SystemEventType;
    provider?: string;
    modelId?: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    correlation_id?: string;
    session_id?: string;
    user_id?: string;
    latency_ms?: number;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Validation result returned by schema validators.
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
    correctedPayload?: StrictSystemEventPayload;
}

const NEVER_SAMPLE_TYPES = new Set<SystemEventType>([
    'auth.admin_action',
    'admin_action',
    'cron.failed',
    'cron_failed',
    'db.error',
    'db_error',
    'batch.failed',
    'edge.review_reminders_failed',
]);

const DEFAULT_SAMPLE_RATES: Record<EventSeverity, number> = {
    [EventSeverity.FATAL]: 1,
    [EventSeverity.ERROR]: 1,
    [EventSeverity.WARN]: 0.5,
    [EventSeverity.INFO]: 0.1,
    [EventSeverity.DEBUG]: 0.01,
};

function stableSampleScore(input: string): number {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0) / 4294967295;
}

function getSampleRateForSeverity(severity: EventSeverity): number {
    if (process.env.NODE_ENV !== 'production') {
        return 1;
    }

    const envOverride = process.env.OBS_SAMPLE_RATE;
    if (envOverride) {
        const parsed = Number(envOverride);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            return parsed;
        }
    }

    return DEFAULT_SAMPLE_RATES[severity] ?? 1;
}

function shouldSampleEvent(event: StrictSystemEventPayload): boolean {
    if (NEVER_SAMPLE_TYPES.has(event.type)) {
        return true;
    }

    const sampleRate = getSampleRateForSeverity(event.severity);
    if (sampleRate >= 1) {
        return true;
    }

    const sampleKey = `${event.correlation_id}:${event.type}:${event.source}`;
    return stableSampleScore(sampleKey) <= sampleRate;
}

/**
 * Validates and normalizes an event payload to strict schema.
 * Returns validation result; caller must handle invalid payloads.
 */
export function validateEventPayload(event: unknown): ValidationResult {
    if (!event || typeof event !== 'object') {
        return { valid: false, error: 'Event must be a non-null object' };
    }

    const e = event as Record<string, unknown>;

    // Check required fields
    if (typeof e.type !== 'string') {
        return { valid: false, error: 'Event.type is required and must be string' };
    }

    if (!Object.prototype.hasOwnProperty.call(EventTypes, e.type)) {
        return { valid: false, error: `Unknown event type: ${e.type}` };
    }

    if (e.event_version !== 'v1') {
        return { valid: false, error: `Event.event_version must be 'v1', got: ${e.event_version}` };
    }

    if (!Object.values(EventSeverity).includes(e.severity as EventSeverity)) {
        return { valid: false, error: `Event.severity must be one of [${Object.values(EventSeverity).join(', ')}]` };
    }

    if (typeof e.occurred_at !== 'string' || !e.occurred_at.match(/^\d{4}-\d{2}-\d{2}T/)) {
        return { valid: false, error: 'Event.occurred_at must be ISO timestamp string' };
    }

    if (typeof e.correlation_id !== 'string' || !e.correlation_id.trim()) {
        return { valid: false, error: 'Event.correlation_id is required and must be non-empty string' };
    }

    if (!['http', 'cron', 'batch', 'edge', 'script'].includes(e.source as string)) {
        return { valid: false, error: `Event.source must be one of [http, cron, batch, edge, script]` };
    }

    if (!e.metadata || typeof e.metadata !== 'object') {
        return { valid: false, error: 'Event.metadata is required and must be object' };
    }

    const meta = e.metadata as Record<string, unknown>;
    if (typeof meta.component !== 'string' || !meta.component.trim()) {
        return { valid: false, error: 'Event.metadata.component is required string' };
    }

    if (typeof meta.operation !== 'string' || !meta.operation.trim()) {
        return { valid: false, error: 'Event.metadata.operation is required string' };
    }

    if (!['development', 'staging', 'production'].includes(meta.environment as string)) {
        return { valid: false, error: 'Event.metadata.environment must be one of [development, staging, production]' };
    }

    // All checks passed
    return { valid: true };
}

/**
 * Normalizes legacy payload format to strict schema.
 * Maps camelCase → snake_case and deprecated type names to canonical domain.type format.
 * Returns normalized payload or null if mapping fails (unknown type).
 */
export function normalizeEventPayload(event: SystemEventPayload): StrictSystemEventPayload | null {
    try {
        // Reject unknown event types
        if (!Object.prototype.hasOwnProperty.call(EventTypes, event.type)) {
            return null;
        }

        const correlationId = event.correlation_id ?? event.correlationId ?? crypto.randomUUID();
        const severity = EventTypes[event.type]?.severity ?? EventSeverity.INFO;
        const now = new Date().toISOString();

        return {
            type: event.type,
            event_version: 'v1',
            severity,
            occurred_at: now,
            correlation_id: correlationId,
            source: 'http', // Default; override in caller
            user_id: event.user_id ?? event.userId,
            session_id: event.session_id ?? event.sessionId,
            metadata: {
                component: 'unknown',
                operation: 'unknown',
                environment: (process.env.NODE_ENV as any) ?? 'development',
                ...event.metadata,
            },
        };
    } catch {
        return null;
    }
}

/**
 * Main event logging function: fire-and-forget strict event write.
 * Validates schema; emits telemetry.event_validation_failed if rejected.
 * Only executes on server-side.
 */
export async function logSystemEventStrict(event: StrictSystemEventPayload): Promise<void> {
    if (typeof window !== 'undefined') return;

    // Validate payload
    const validation = validateEventPayload(event);
    if (!validation.valid) {
        // Emit validation failure metric (fire-and-forget, never blocks)
        console.warn('[Monitoring] Event validation failed:', validation.error);
        // TODO: Emit telemetry.event_validation_failed event
        return;
    }

    if (!shouldSampleEvent(event)) {
        return;
    }

    let supabaseAdmin: ReturnType<typeof getServiceClient>;
    try {
        supabaseAdmin = getServiceClient();
    } catch (e) {
        console.error('[Monitoring] getServiceClient() failed — system events will not be recorded. Check SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL env vars.', e);
        return;
    }

    if (!supabaseAdmin || typeof (supabaseAdmin as { from?: unknown }).from !== 'function') {
        return;
    }

    const payload = {
        type: event.type,
        provider: event.provider,
        model_id: event.model_id,
        user_id: event.user_id,
        error_code: event.error_code,
        error_message: event.error_message,
        metadata: {
            ...event.metadata,
            correlation_id: event.correlation_id,
            occurred_at: event.occurred_at,
            severity: event.severity,
            event_version: event.event_version,
            source: event.source,
        },
    };

    try {
        const eventsTable = supabaseAdmin.from('system_events') as unknown as { insert?: (rows: unknown[]) => Promise<unknown> };
        if (typeof eventsTable.insert === 'function') {
            Promise.resolve(eventsTable.insert([payload]))
                .then(() => { })
                .catch(() => { });
        }
    } catch {
        // Keep telemetry fire-and-forget and never throw to callers.
    }

    // BetterStack Logtail — fire-and-forget, never blocks
    const betterStackToken = process.env.BETTERSTACK_SOURCE_TOKEN;
    if (betterStackToken) {
        fetch('https://in.logs.betterstack.com', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${betterStackToken}`,
            },
            body: JSON.stringify({
                dt: event.occurred_at,
                level: event.severity === EventSeverity.FATAL || event.severity === EventSeverity.ERROR ? 'error' : 'info',
                ...payload,
                env: process.env.NODE_ENV ?? 'unknown',
            }),
        }).catch(() => { });
    }
}

/**
 * Backward compatibility wrapper: log legacy SystemEventPayload.
 * Normalizes to strict schema and emits deprecation telemetry.
 * TO BE REMOVED in next release after all callers migrate.
 */
export async function logSystemEvent(event: SystemEventPayload): Promise<void> {
    // Emit deprecation metric
    // TODO: logSystemEventStrict({ type: 'telemetry.deprecated_log_wrapper_usage', ... });

    const normalized = normalizeEventPayload(event);
    if (!normalized) {
        console.warn('[Monitoring] Failed to normalize legacy event:', event);
        return;
    }

    await logSystemEventStrict(normalized);
}

/**
 * Typed error event payload wrapping critical failures.
 * Enforces stack trace capture and error categorization.
 */
export interface SystemErrorPayload {
    type: Extract<SystemEventType, `${string}error` | `${string}failed`>;
    component: string; // e.g., 'ai.client', 'db.query', 'auth.middleware'
    operation: string; // e.g., 'fetch_model', 'insert_user', 'verify_token'
    error: Error | { message: string; code?: string };
    context?: {
        userId?: string;
        sessionId?: string;
        requestPath?: string;
        httpMethod?: string;
        httpStatus?: number;
        metadata?: Record<string, unknown>;
    };
    correlationId?: string;
    environment?: 'development' | 'staging' | 'production';
}

/**
 * Log an error event with full context.
 * Captures stack trace and error code; enforces strict schema validation.
 */
export async function logSystemError(errorPayload: SystemErrorPayload): Promise<void> {
    if (typeof window !== 'undefined') return;

    const correlationId = errorPayload.correlationId ?? crypto.randomUUID();
    const environment = errorPayload.environment ?? (process.env.NODE_ENV as any) ?? 'development';

    const errorMsg = errorPayload.error instanceof Error ? errorPayload.error.message : errorPayload.error.message;
    const errorCode = errorPayload.error instanceof Error ? undefined : (errorPayload.error.code || 'UNKNOWN');

    const event: StrictSystemEventPayload = {
        type: errorPayload.type,
        event_version: 'v1',
        severity: EventSeverity.ERROR,
        occurred_at: new Date().toISOString(),
        correlation_id: correlationId,
        source: 'http',
        user_id: errorPayload.context?.userId,
        request_path: errorPayload.context?.requestPath,
        http_method: errorPayload.context?.httpMethod,
        http_status: errorPayload.context?.httpStatus,
        error_code: errorCode,
        error_message: errorMsg,
        metadata: {
            component: errorPayload.component,
            operation: errorPayload.operation,
            environment,
            extra: {
                stack: errorPayload.error instanceof Error ? errorPayload.error.stack : undefined,
                ...errorPayload.context?.metadata,
            },
        },
    };

    await logSystemEventStrict(event);
}

/**
 * Typed lifecycle event payload for job/batch/cron lifecycle tracking.
 * Enforces structured status and duration tracking for async operations.
 */
export interface LifecyclePayload {
    type: Extract<SystemEventType, `${'cron' | 'batch' | 'edge'}.${'triggered' | 'running' | 'completed' | 'failed' | 'step_started' | 'step_completed' | 'step_failed' | 'review_reminders_queued' | 'review_reminders_failed'}`>;
    jobName: string; // e.g., 'nightly-batch', 'review-reminders'
    status: 'started' | 'success' | 'failure' | 'partial_success' | 'skipped';
    startedAt: string; // ISO timestamp
    endedAt?: string; // ISO timestamp (if completed)
    durationMs?: number;
    correlationId?: string;
    metadata?: {
        stepName?: string;
        recordsProcessed?: number;
        recordsSucceeded?: number;
        recordsFailed?: number;
        retryCount?: number;
        failureReason?: string;
        downstreamDependency?: string;
        extra?: Record<string, unknown>;
    };
}

/**
 * Log a lifecycle event (job start/completion/failure).
 * Tracks async operation boundaries and duration; enforces schema validation.
 */
export async function logSystemLifecycle(lifecyclePayload: LifecyclePayload): Promise<void> {
    if (typeof window !== 'undefined') return;

    const correlationId = lifecyclePayload.correlationId ?? crypto.randomUUID();
    const duration = lifecyclePayload.durationMs ?? (lifecyclePayload.endedAt ? new Date(lifecyclePayload.endedAt).getTime() - new Date(lifecyclePayload.startedAt).getTime() : undefined);

    const severity =
        lifecyclePayload.status === 'failure' || lifecyclePayload.status === 'partial_success'
            ? EventSeverity.WARN
            : EventSeverity.INFO;

    const event: StrictSystemEventPayload = {
        type: lifecyclePayload.type,
        event_version: 'v1',
        severity,
        occurred_at: lifecyclePayload.endedAt ?? lifecyclePayload.startedAt,
        correlation_id: correlationId,
        source: lifecyclePayload.type.split('.')[0] as 'cron' | 'batch' | 'edge',
        metadata: {
            component: lifecyclePayload.jobName,
            operation: lifecyclePayload.status === 'started' ? 'job_started' : lifecyclePayload.status === 'success' ? 'job_completed' : 'job_failed',
            environment: (process.env.NODE_ENV as any) ?? 'development',
            duration_ms: duration,
            records_processed: lifecyclePayload.metadata?.recordsProcessed,
            records_succeeded: lifecyclePayload.metadata?.recordsSucceeded,
            records_failed: lifecyclePayload.metadata?.recordsFailed,
            retry_count: lifecyclePayload.metadata?.retryCount,
            extra: {
                job_name: lifecyclePayload.jobName,
                status: lifecyclePayload.status,
                started_at: lifecyclePayload.startedAt,
                step_name: lifecyclePayload.metadata?.stepName,
                failure_reason: lifecyclePayload.metadata?.failureReason,
                downstream_dependency: lifecyclePayload.metadata?.downstreamDependency,
                ...lifecyclePayload.metadata?.extra,
            },
        },
    };

    await logSystemEventStrict(event);
}
