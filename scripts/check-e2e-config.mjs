const requiredSecrets = {
    NEXT_PUBLIC_SUPABASE_URL: 'SUPABASE_TEST_URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'SUPABASE_TEST_ANON_KEY',
    SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_TEST_SERVICE_KEY',
    TEST_USER_EMAIL: 'TEST_USER_EMAIL or E2E_TEST_EMAIL',
};

const missing = Object.entries(requiredSecrets)
    .filter(([name]) => !process.env[name]?.trim())
    .map(([, secret]) => secret);

if (missing.length > 0) {
    console.error('Missing GitHub Actions secrets for the E2E test workspace: ' + missing.join(', '));
    process.exitCode = 1;
}
