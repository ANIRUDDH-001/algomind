import { getServiceClient } from '@/lib/supabase/service';
import { getCorrelationId } from '@/lib/tracing/correlation';

export type SystemEventType =
    | 'llm_request'
    | 'model_429'
    | 'model_deprecated'
    | 'model_timeout'
    | 'model_error'
    | 'model_verification_failed'
    | 'db_error'
    | 'embedding_failed'
    | 'user_rate_limit'
    | 'leetcode_fetch_failed'
    | 'piston_error'
    | 'cron_completed'
    | 'cron_failed'
    | 'cron_triggered'
    | 'cron_running'
    | 'batch_job_complete'
    | 'assessment_insufficient'
    | 'voice_session_start'
    | 'tts_fallback'
    | 'stt_fallback'
    | 'vad_fallback'
    | 'admin_action'
    | 'transcript_save_failed'
    | 'kg_cache_hit'
    | 'kg_cache_miss'
    | 'prompt_size_warning'
    | 'route_error';

export interface SystemEventPayload {
    type: SystemEventType;
    provider?: string;
    modelId?: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    errorCode?: string;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Logs a system event to the 'system_events' table asynchronously.
 * Completely fire-and-forget: it will never throw errors or log anything to the console.
 * Only attempts to log when executed on the server-side.
 */
export async function logSystemEvent(event: SystemEventPayload): Promise<void> {
    // Only execute server-side
    if (typeof window !== 'undefined') return;

    let supabaseAdmin: ReturnType<typeof getServiceClient>;
    try {
        supabaseAdmin = getServiceClient();
    } catch (e) {
        console.error('[Monitoring] getServiceClient() failed — system events will not be recorded. Check SUPABASE_SERVICE_ROLE_KEY / SUPABASE_URL env vars.', e);
        return;
    }

    const correlationId = event.correlationId ?? await getCorrelationId();
    const metadata = {
        ...(event.metadata ?? {}),
        correlation_id: correlationId,
        session_id: event.sessionId,
        user_id: event.userId,
        timestamp: new Date().toISOString(),
    };

    const payload = {
        type: event.type,
        provider: event.provider,
        model_id: event.modelId, // Mapping to db column
        user_id: event.userId,
        error_code: event.errorCode,
        error_message: event.errorMessage,
        metadata,
    };

    // True fire-and-forget: catch any errors and silently discard them
    Promise.resolve(
        supabaseAdmin.from('system_events').insert([payload])
    )
        .then(() => { })
        .catch(() => { });

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
                dt: new Date().toISOString(),
                level: ['model_error', 'db_error', 'cron_failed', 'transcript_save_failed', 'route_error']
                    .includes(event.type) ? 'error' : 'info',
                ...payload,
                env: process.env.NODE_ENV ?? 'unknown',
            }),
        }).catch(() => { });
    }
}
