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
    }
}
