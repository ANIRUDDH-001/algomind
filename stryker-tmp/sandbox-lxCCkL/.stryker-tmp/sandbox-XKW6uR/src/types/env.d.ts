/**
 * @codesage
 * @file      src/types/env.d.ts
 * @purpose   TypeScript environment variable declarations and type definitions for NodeJS.ProcessEnv.
 * @tech      TypeScript
 * @connects  Provides global intellisense and typing for process.env across the entire application.
 * @apis      none
 * @db        none
 * @state     none
 * @env       Defines application-wide environment variables including API keys, Supabase URLs, and AWS configs.
 * @issues    No dead code or unused imports found.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 


declare namespace NodeJS {
    interface ProcessEnv {
        // AI Provider Keys
        GROQ_API_KEY?: string;
        GEMINI_API_KEY?: string;
        GOOGLE_API_KEY?: string; // Alternative to GEMINI_API_KEY


        // Model IDs (Optional Overrides)
        GROQ_GPT_OSS_MODEL_ID?: string;
        GROQ_GPT_OSS_20B_MODEL_ID?: string;
        GEMINI_FREE_TIER_MODEL_ID?: string;

        // Next.js & General
        NODE_ENV: 'development' | 'production' | 'test';
        NEXT_PUBLIC_APP_URL?: string;

        // Supabase
        NEXT_PUBLIC_SUPABASE_URL: string;           // Points to CF Worker in production
        NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
        SUPABASE_SERVICE_ROLE_KEY: string;
        SUPABASE_DIRECT_URL?: string;               // Direct Supabase URL (server-only, bypasses CF Worker)
        SUPABASE_JWT_SECRET: string;               // Required: JWT signing secret for assessment sessions. See REMEDY 01.

        // Redis / Upstash
        UPSTASH_REDIS_REST_URL?: string;
        UPSTASH_REDIS_REST_TOKEN?: string;
        CACHE_BACKEND?: 'memory' | 'redis';

        // AWS (flag-gated: ENABLE_AWS_POLLY_TTS / ENABLE_AWS_S3_STORAGE / ENABLE_AWS_TRANSCRIBE_STT)
        AWS_ACCESS_KEY_ID?: string;
        AWS_SECRET_ACCESS_KEY?: string;
        AWS_S3_BUCKET?: string;
        AWS_REGION?: string;                    // Default: ap-south-1 (Polly, S3, Transcribe)
        AWS_BEDROCK_REGION?: string;             // Default: us-east-1 (Bedrock model availability)

        // Feature Flags
        NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE?: string;
        NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING?: string;

        // Execution & Jobs
        PISTON_URL?: string;
        CRON_SECRET?: string;

        // Voice / Audio (Testing)
        NEXT_PUBLIC_ENABLE_VAD_TEST?: string;
        NEXT_PUBLIC_VAD_DEBUG?: string;

        // GitHub Integration
        GITHUB_TOKEN?: string;
        GITHUB_REPO?: string;
    }
}
