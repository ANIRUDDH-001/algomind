/**
 * @codesage
 * @file      src/lib/startup/validateEnv.ts
 * @purpose   Environment validation at system startup.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       process.env variables
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
import { createServerSupabase } from '@/lib/supabase/server';
import { assertAssessmentSecretIsUnique } from '@/lib/assess/jwt';


type CriticalEnvVar = {
    key: keyof NodeJS.ProcessEnv;
    use: string;
    anyOf?: Array<keyof NodeJS.ProcessEnv>;
};

export function validateEnv(): void {
    // Skip strict runtime validation during Next.js static build phase 
    // to prevent build failures from missing production-only secrets
    if (
        process.env.npm_lifecycle_event === 'build' || 
        process.env.NEXT_PHASE === 'phase-production-build'
    ) {
        return;
    }

    const criticalVars: CriticalEnvVar[] = [
        { key: "NEXT_PUBLIC_SUPABASE_URL", use: "Supabase project URL" },
        { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", use: "Supabase anon key" },
        { key: "SUPABASE_SERVICE_ROLE_KEY", use: "Service role key (NEVER use as JWT secret)" },
        { key: "SUPABASE_JWT_SECRET", use: "JWT signing secret for candidate assessment sessions — must be separate from service role key" },
        {
            key: "INTERNAL_API_SECRET",
            use: "Authorization secret for invoking the run-assessment Supabase Edge Function — missing means all candidate assessments complete with no AI analysis."
        },
        {
            key: "ASSESSMENT_JWT_SECRET",
            use: "JWT secret for signing and verifying assessment session tokens — must be a unique secret, never the same value as SUPABASE_JWT_SECRET. Missing means all assessment endpoints are unauthenticated."
        },
        { key: "GEMINI_API_KEY", use: "Gemini API key", anyOf: ["GOOGLE_API_KEY"] },

        // ── Payment (Razorpay) ───────────────────────────────────────────────────
        {
            key: "RAZORPAY_KEY_ID",
            use: "Razorpay public key ID — required for creating payment orders. Missing means no payments can be initiated."
        },
        {
            key: "RAZORPAY_KEY_SECRET",
            use: "Razorpay key secret — required for verifying payment signatures on the verify route. Missing means payment verification will fail for all users."
        },
        {
            key: "RAZORPAY_WEBHOOK_SECRET",
            use: "Razorpay webhook HMAC secret — required for authenticating all incoming Razorpay webhook events. MISSING MEANS ALL WEBHOOK EVENTS ARE ACCEPTED WITHOUT AUTHENTICATION, allowing anyone to grant free premium subscriptions or cancel real subscriptions."
        },
    ];

    for (const { key, use, anyOf } of criticalVars) {
        const hasPrimary = Boolean(process.env[key]);
        const hasAlias = anyOf?.some((alias) => Boolean(process.env[alias])) ?? false;
        if (!hasPrimary && !hasAlias) {
            const aliasSuffix = anyOf?.length ? ` (or ${anyOf.join(' / ')})` : '';
            throw new Error(`CRITICAL ENV VAR MISSING: ${key}${aliasSuffix}. Used for: ${use}`);
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

        // Payments (moved to criticalVars)

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

    // ── Minimum entropy check for cryptographic secrets ─────────────────────
    const SECRET_MIN_LENGTH = 32;
    const secretVars = [
        'RAZORPAY_KEY_SECRET',
        'RAZORPAY_WEBHOOK_SECRET',
        'ASSESSMENT_JWT_SECRET',
        'INTERNAL_API_SECRET',
        'SUPABASE_JWT_SECRET',
    ];

    const weakSecrets = secretVars
        .filter(key => process.env[key] && (process.env[key]?.length ?? 0) < SECRET_MIN_LENGTH)
        .map(key => `${key} (length: ${process.env[key]?.length ?? 0}, minimum: ${SECRET_MIN_LENGTH})`);

    if (weakSecrets.length > 0) {
        console.warn(
            `[validateEnv] WARNING: The following secrets are shorter than ${SECRET_MIN_LENGTH} characters ` +
            `and may be insufficiently strong for production:\n  ${weakSecrets.join('\n  ')}`
        );
        // Warn only (not fatal) — some valid secrets like Razorpay test keys are shorter
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

    try {
        assertAssessmentSecretIsUnique();
    } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
    }
}

export const env = {
    // Critical
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
    ASSESSMENT_JWT_SECRET: process.env.ASSESSMENT_JWT_SECRET,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,

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
