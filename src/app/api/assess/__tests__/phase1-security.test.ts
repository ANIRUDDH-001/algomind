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
import { getAssessmentSecret, encodeAssessmentSecret, assertAssessmentSecretIsUnique } from '@/lib/assess/jwt';

describe('getAssessmentSecret', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    it('returns ASSESSMENT_JWT_SECRET if valid', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars-long';
        expect(getAssessmentSecret()).toBe('a-very-long-secret-that-is-at-least-32-chars-long');
    });

    it('throws if ASSESSMENT_JWT_SECRET is missing', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        expect(() => getAssessmentSecret()).toThrow('[Assessment JWT] ASSESSMENT_JWT_SECRET is not set');
    });

    it('throws if ASSESSMENT_JWT_SECRET is too short', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'too-short';
        expect(() => getAssessmentSecret()).toThrow('[Assessment JWT] ASSESSMENT_JWT_SECRET is too short');
    });

    it('encodeAssessmentSecret returns Uint8Array', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars-long';
        const encoded = encodeAssessmentSecret();
        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(encoded.length).toBeGreaterThan(0);
    });

    it('throws if ASSESSMENT_JWT_SECRET is the same as SUPABASE_JWT_SECRET', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars-long';
        process.env.SUPABASE_JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars-long';
        expect(() => assertAssessmentSecretIsUnique()).toThrow('[Assessment JWT] FATAL');
    });

    it('does not throw if ASSESSMENT_JWT_SECRET is unique', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a-very-long-secret-that-is-at-least-32-chars-long';
        process.env.SUPABASE_JWT_SECRET = 'different-long-secret-that-is-at-least-32-chars-long';
        expect(() => assertAssessmentSecretIsUnique()).not.toThrow();
    });
});
