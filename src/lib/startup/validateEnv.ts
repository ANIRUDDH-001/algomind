export function validateEnv(): void {
    const criticalVars = [
        { key: "NEXT_PUBLIC_SUPABASE_URL", use: "Supabase project URL" },
        { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", use: "Supabase anon key" },
        { key: "SUPABASE_SERVICE_ROLE_KEY", use: "Service role key (NEVER use fallback string for this)" },
        { key: "UPSTASH_REDIS_REST_URL", use: "Upstash Redis URL" },
        { key: "UPSTASH_REDIS_REST_TOKEN", use: "Upstash Redis token" },
    ];

    for (const { key, use } of criticalVars) {
        if (!process.env[key]) {
            throw new Error(`CRITICAL ENV VAR MISSING: ${key}. Used for: ${use}`);
        }
    }

    const highVars = [
        { key: "CRON_SECRET", issue: "nightly batch will fail to trigger" },
        { key: "PISTON_URL", issue: "defaults to public emkc.org endpoint (throttle risk)" },
        { key: "GITHUB_TOKEN", issue: "cron GitHub trigger will fail" },
        { key: "GITHUB_REPO", issue: "cron GitHub trigger will fail" },
        { key: "DEEPSEEK_API_KEY", issue: "DeepSeek model verification will fail - send Bearer undefined to DeepSeek API" },
    ];

    for (const { key, issue } of highVars) {
        if (!process.env[key]) {
            console.warn(`HIGH ENV VAR MISSING: ${key} - ${issue}`);
        }
    }
}

export const env = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL as string,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    CRON_SECRET: process.env.CRON_SECRET,
    PISTON_URL: process.env.PISTON_URL,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPO: process.env.GITHUB_REPO,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
};
