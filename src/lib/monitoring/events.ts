import { getServiceClient } from '@/lib/supabase/service';

export type SystemEventType =
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
    | 'admin_action';

export interface SystemEventPayload {
    type: SystemEventType;
    provider?: string;
    modelId?: string;
    userId?: string;
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
    } catch {
        return; // Missing env vars — silently skip
    }

    const payload = {
        type: event.type,
        provider: event.provider,
        model_id: event.modelId, // Mapping to db column
        user_id: event.userId,
        error_code: event.errorCode,
        error_message: event.errorMessage,
        metadata: event.metadata,
    };

    // True fire-and-forget: catch any errors and silently discard them
    Promise.resolve(
        supabaseAdmin.from('system_events').insert([payload])
    )
        .then(() => { })
        .catch(() => { });
}
