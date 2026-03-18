import { createServerSupabase } from '@/lib/supabase/server';


export function validateEnv(): void {
    const criticalVars = [
        { key: "NEXT_PUBLIC_SUPABASE_URL", use: "Supabase project URL" },
        { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", use: "Supabase anon key" },
        { key: "SUPABASE_SERVICE_ROLE_KEY", use: "Service role key (NEVER use as JWT secret)" },
        { key: "SUPABASE_JWT_SECRET", use: "JWT signing secret for candidate assessment sessions — must be separate from service role key" },
        { key: "INTERNAL_API_SECRET", use: "Authorization secret for invoking run-assessment edge function — missing means all candidate assessments complete with no analysis" },
        { key: "ASSESSMENT_JWT_SECRET", use: "Dedicated JWT signing secret for candidate assessment sessions — falls back to SUPABASE_JWT_SECRET if absent but should be set explicitly" },
    ];

    for (const { key, use } of criticalVars) {
        if (!process.env[key]) {
            throw new Error(`CRITICAL ENV VAR MISSING: ${key}. Used for: ${use}`);
        }
    }

    const highVars = [
        // AI Providers — fail silently at interview time if missing
        { key: "GROQ_API_KEY", issue: "Whisper STT (/api/voice/transcribe) and Groq TTS will return 503 when flags are ON" },

        // AWS — only relevant when ENABLE_AWS_POLLY_TTS or ENABLE_AWS_S3_STORAGE flags are ON
        { key: "AWS_ACCESS_KEY_ID", issue: "AWS Polly TTS + S3 storage + Transcribe will fail silently" },
        { key: "AWS_SECRET_ACCESS_KEY", issue: "AWS Polly TTS + S3 storage + Transcribe will fail silently" },
        { key: "AWS_S3_BUCKET", issue: "S3 audio storage will fail — falls back to Supabase storage" },
        { key: "AWS_REGION", issue: "AWS SDK will fail to initialise (expected: ap-south-1)" },

        // Redis
        { key: "UPSTASH_REDIS_REST_URL", issue: "Redis disabled — AI rate limiting degrades to fail-open" },
        { key: "UPSTASH_REDIS_REST_TOKEN", issue: "Redis disabled — AI rate limiting degrades to fail-open" },

        // Auth
        { key: "NEXT_PUBLIC_APP_URL", issue: "OAuth callback URLs will be wrong — OAuth login will fail in production" },
        { key: "SUPABASE_DIRECT_URL", issue: "Supabase Realtime and direct DB connections may fail" },

        // Operational
        { key: "CRON_SECRET", issue: "Nightly batch cron will fail to trigger" },
        { key: "GITHUB_TOKEN", issue: "Cron GitHub trigger will fail" },
        { key: "GITHUB_REPO", issue: "Cron GitHub trigger will fail" },

        // Code execution
        { key: "PISTON_URL", issue: "Code execution will fall back to public emkc.org endpoint which may be rate-limited" },
    ];

    for (const { key, issue } of highVars) {
        if (!process.env[key]) {
            console.warn(`HIGH ENV VAR MISSING: ${key} - ${issue}`);
        }
    }

    // Warn on known-dead env vars that should have been removed
    const deadVars = [
        'GROQ_TTS_MODEL',  // No Groq TTS implementation exists. Remove from Vercel.
    ];
    for (const v of deadVars) {
        if (process.env[v as keyof NodeJS.ProcessEnv]) {
            console.warn(`[validateEnv] WARNING: ${v} is set but not used by any code. Remove it from Vercel to avoid confusion.`);
        }
    }
}

export const env = {
    // Critical
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,

    // AI providers
    GROQ_API_KEY: process.env.GROQ_API_KEY,

    // AWS
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
    AWS_REGION: process.env.AWS_REGION ?? 'ap-south-1',
    AWS_BEDROCK_REGION: process.env.AWS_BEDROCK_REGION ?? 'us-east-1',

    // Redis
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,

    // Auth
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SUPABASE_DIRECT_URL: process.env.SUPABASE_DIRECT_URL,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,

    // Operational
    CRON_SECRET: process.env.CRON_SECRET,
    PISTON_URL: process.env.PISTON_URL,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
} as const;

export async function validateDB(): Promise<void> {
    try {
        const supabase = await createServerSupabase();

        const dummyId = '00000000-0000-0000-0000-000000000000';
        const rpcChecks = [
            { name: 'check_is_admin', args: {} },
            { name: 'get_model_rate_stats', args: {} },
            { name: 'check_user_rate_limit', args: { p_user_id: dummyId, p_limit: 5 } },
            { name: 'get_user_sessions_with_assessment', args: { p_user_id: dummyId, p_limit: 1 } },
        ];

        for (const { name, args } of rpcChecks) {
            const { error } = await supabase.rpc(name, args);
            if (error?.code === 'PGRST202') {
                // PGRST202 = "Function not found" — migration not applied
                const msg = `[DB VALIDATION] MISSING RPC: ${name}. ` +
                    `ALL admin functionality will return 403 until this is fixed. ` +
                    `Apply 001_master.sql: supabase db push`;
                console.error(msg);
                // For check_is_admin specifically: this is severe enough to warn loudly
                if (name === 'check_is_admin') {
                    console.error('[DB VALIDATION] CRITICAL: check_is_admin missing — admin panel is completely broken');
                }
            } else if (error && !['PGRST301', '42501'].includes(error.code ?? '')) {
                // 42501 = permission denied for dummy UUID (expected for security)
                // Any other error is unexpected
                console.warn(`[DB VALIDATION] RPC ${name} returned unexpected error: ${error.code} — ${error.message}`);
            }
        }

        const criticalTables = [
            'admin_users',
            'user_preferences',
            'system_events',
            'global_feature_flags',  // DB-002: must exist for all feature flags to work
            'profiles',              // Core user table
            'interview_sessions',    // Core session storage
        ];
        for (const table of criticalTables) {
            const { error } = await supabase.from(table).select('id').limit(0);
            if (error?.code === '42P01') {
                console.error(
                    `[DB VALIDATION] MISSING TABLE: ${table}. ` +
                    `This means 001_master.sql was not applied or the migration is incomplete. ` +
                    `Run: supabase db push or apply migrations manually.`
                );
            } else if (error && error.code !== 'PGRST301') {
                // PGRST301 = "no rows" which is fine for empty tables; any other error is suspicious
                console.warn(`[DB VALIDATION] Unexpected error on table ${table}: ${error.code} — ${error.message}`);
            }
        }
    } catch (e) {
        console.warn('[DB VALIDATION] Could not run DB validation:', e);
    }
}
