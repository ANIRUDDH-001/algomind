/**
 * @codesage
 * @file      src/app/api/assess/__tests__/phase1-security.test.ts
 * @purpose   Tests fallback and validation logic for assessment JWT secrets.
 * @tech      Vitest, TypeScript
 * @connects  @/lib/assess/jwt
 * @apis      none
 * @db        none
 * @state     none
 * @env       ASSESSMENT_JWT_SECRET, SUPABASE_JWT_SECRET
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAssessmentSecret, encodeAssessmentSecret } from '@/lib/assess/jwt';

describe('getAssessmentSecret', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    it('prefers ASSESSMENT_JWT_SECRET over SUPABASE_JWT_SECRET', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'new-secret';
        process.env.SUPABASE_JWT_SECRET = 'old-secret';
        expect(getAssessmentSecret()).toBe('new-secret');
    });

    it('falls back to SUPABASE_JWT_SECRET when ASSESSMENT_JWT_SECRET missing', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        process.env.SUPABASE_JWT_SECRET = 'fallback-secret';
        expect(getAssessmentSecret()).toBe('fallback-secret');
    });

    it('throws when neither secret is set', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        process.env.SUPABASE_JWT_SECRET = '';
        expect(() => getAssessmentSecret()).toThrow('[Assessment JWT]');
    });

    it('encodeAssessmentSecret returns Uint8Array', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'test-secret';
        const encoded = encodeAssessmentSecret();
        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(encoded.length).toBeGreaterThan(0);
    });
});
