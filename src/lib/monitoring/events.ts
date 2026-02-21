import { createClient } from '@supabase/supabase-js';

export type SystemEventType =
    | 'model_429'
    | 'model_deprecated'
    | 'model_timeout'
    | 'model_error'
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
 * Creates a singleton Supabase service role client specifically for system events.
 * Bypasses RLS to allow system-level logging from edge or node environments.
 * Returns null if the required environment variables are not set.
 */
function getEventLoggerClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return null;
    }

    // Use the service role key to bypass RLS, this client is strictly server-side
    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

// Lazy singleton — ensures env vars are loaded before client creation
let supabaseAdmin: ReturnType<typeof getEventLoggerClient> | undefined = undefined;

/**
 * Logs a system event to the 'system_events' table asynchronously.
 * Completely fire-and-forget: it will never throw errors or log anything to the console.
 * Only attempts to log when executed on the server-side.
 */
export async function logSystemEvent(event: SystemEventPayload): Promise<void> {
    // Only execute server-side
    if (typeof window !== 'undefined') return;

    // Lazy init — ensures env vars are loaded before client creation
    if (supabaseAdmin === undefined) {
        supabaseAdmin = getEventLoggerClient();
    }

    if (!supabaseAdmin) return;

    const payload = {
        type: event.type,
        provider: event.provider,
        model_id: event.modelId, // Mapping to db column
        user_id: event.userId,   // Assuming this mapping might also be useful, not explicitly requested to not do it
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
