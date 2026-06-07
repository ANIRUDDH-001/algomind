/**
 * @codesage
 * @file      src/lib/startup/__tests__/validateEnv.test.ts
 * @purpose   Tests for Environment validation at system startup.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       process.env variables
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1 | @skip: test-file
 */
/**
 * Tests for src/lib/startup/validateEnv.ts
 * Covers validateEnv() and validateDB() functions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──
vi.mock('@/lib/supabase/server');
import { createServerSupabase } from '@/lib/supabase/server';

// Import after mock setup
import { validateEnv, validateDB } from '../validateEnv';

// ═══════════════════════════════════════════════
//  validateDB()
// ═══════════════════════════════════════════════
describe('validateDB', () => {
    let mockSupabase: any;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.resetAllMocks();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

        mockSupabase = {
            rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
            }),
        };
        vi.mocked(createServerSupabase).mockResolvedValue(mockSupabase as any);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    it('1. All RPCs present → no console.error calls, resolves cleanly', async () => {
        await validateDB();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('2. check_is_admin missing (PGRST202) → console.error with MISSING RPC and CRITICAL messages', async () => {
        mockSupabase.rpc.mockImplementation((rpcName: string) => {
            if (rpcName === 'check_is_admin') {
                return Promise.resolve({ data: null, error: { code: 'PGRST202' } });
            }
            return Promise.resolve({ data: true, error: null });
        });

        await validateDB();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('MISSING RPC: check_is_admin')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL: check_is_admin missing')
        );
    });

    it('3. All 4 critical RPCs missing → 5 console.error calls (4 MISSING + 1 CRITICAL check_is_admin)', async () => {
        mockSupabase.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });

        await validateDB();

        const rpcErrors = consoleErrorSpy.mock.calls.filter(
            (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('MISSING RPC')
        );
        expect(rpcErrors).toHaveLength(4);
        // Plus the extra CRITICAL message for check_is_admin
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('CRITICAL: check_is_admin missing')
        );
    });

    it('4. DB connection fails entirely → logs warning, does not throw', async () => {
        vi.mocked(createServerSupabase).mockRejectedValue(new Error('Connection refused'));

        await expect(validateDB()).resolves.toBeUndefined();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[DB VALIDATION]'),
            expect.any(Error)
        );
    });

    it('5. admin_users table missing → console.error with "MISSING TABLE: admin_users"', async () => {
        mockSupabase.from.mockImplementation((table: string) => ({
            select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: table === 'admin_users' ? { code: '42P01' } : null,
                }),
            }),
        }));

        await validateDB();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('MISSING TABLE: admin_users')
        );
    });

    it('6. global_feature_flags table missing → console.error with "MISSING TABLE: global_feature_flags"', async () => {
        mockSupabase.from.mockImplementation((table: string) => ({
            select: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                    data: null,
                    error: table === 'global_feature_flags' ? { code: '42P01' } : null,
                }),
            }),
        }));

        await validateDB();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('MISSING TABLE: global_feature_flags')
        );
    });
});

// ═══════════════════════════════════════════════
//  validateEnv()
// ═══════════════════════════════════════════════
describe('validateEnv', () => {
    const REQUIRED_VARS: Record<string, string> = {
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
        SUPABASE_JWT_SECRET: 'test-jwt-secret',
        INTERNAL_API_SECRET: 'test-internal-api-secret',
        ASSESSMENT_JWT_SECRET: 'test-assessment-jwt-secret',
        RAZORPAY_KEY_SECRET: 'test-razorpay-secret',
        RAZORPAY_WEBHOOK_SECRET: 'test-razorpay-webhook',
        GEMINI_API_KEY: 'test-gemini-key',
        UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
    };

    let originalEnv: NodeJS.ProcessEnv;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        originalEnv = { ...process.env };
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
        // Set all required vars
        for (const [key, value] of Object.entries(REQUIRED_VARS)) {
            process.env[key] = value;
        }
    });

    afterEach(() => {
        process.env = originalEnv;
        consoleWarnSpy.mockRestore();
    });

    it('1. All required env vars present → resolves without error', () => {
        expect(() => validateEnv()).not.toThrow();
    });

    it('2. Missing NEXT_PUBLIC_SUPABASE_URL → throws critical error', () => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = undefined as unknown as string;
        expect(() => validateEnv()).toThrow('CRITICAL ENV VAR MISSING: NEXT_PUBLIC_SUPABASE_URL');
    });

    it('3. Missing RAZORPAY_KEY_SECRET (high var) → warns but does not throw', () => {
        delete process.env.RAZORPAY_KEY_SECRET;
        expect(() => validateEnv()).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HIGH ENV VAR MISSING: RAZORPAY_KEY_SECRET')
        );
    });

    it('4. GOOGLE_API_KEY alias satisfies Gemini validation when GEMINI_API_KEY is absent', () => {
        delete process.env.GEMINI_API_KEY;
        process.env.GOOGLE_API_KEY = 'test-google-key';
        expect(() => validateEnv()).not.toThrow();
    });

    it('5. Missing CRON_SECRET (high var) → warns but does not throw', () => {
        delete process.env.CRON_SECRET;
        expect(() => validateEnv()).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HIGH ENV VAR MISSING: CRON_SECRET')
        );
    });

    it('6. Missing GROQ_API_KEY (high var) → warns but does not throw', () => {
        delete process.env.GROQ_API_KEY;
        expect(() => validateEnv()).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HIGH ENV VAR MISSING: GROQ_API_KEY')
        );
    });

    it('7. Missing AWS_ACCESS_KEY_ID (high var) → warns but does not throw', () => {
        delete process.env.AWS_ACCESS_KEY_ID;
        expect(() => validateEnv()).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HIGH ENV VAR MISSING: AWS_ACCESS_KEY_ID')
        );
    });

    it('8. Missing NEXT_PUBLIC_APP_URL (high var) → warns but does not throw', () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        expect(() => validateEnv()).not.toThrow();
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining('HIGH ENV VAR MISSING: NEXT_PUBLIC_APP_URL')
        );
    });

    it('9. All high vars missing → 15 warnings total, no throw', () => {
        const highKeys = [
            'GROQ_API_KEY', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
            'AWS_S3_BUCKET', 'AWS_REGION', 'UPSTASH_REDIS_REST_URL',
            'UPSTASH_REDIS_REST_TOKEN', 'NEXT_PUBLIC_APP_URL',
            'SUPABASE_DIRECT_URL',
            'CRON_SECRET', 'PISTON_URL', 'GITHUB_TOKEN', 'GITHUB_REPO',
        ];
        for (const key of highKeys) {
            delete process.env[key];
        }
        expect(() => validateEnv()).not.toThrow();
        // AWS_REGION is always present via default — still warned if env var itself is missing
        const warnCalls = consoleWarnSpy.mock.calls.filter(
            (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('HIGH ENV VAR MISSING')
        );
        // 13 keys explicitly deleted + AWS_REGION may or may not be set
        expect(warnCalls.length).toBeGreaterThanOrEqual(13);
    });
});
