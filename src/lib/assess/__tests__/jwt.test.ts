import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAssessmentSecret, encodeAssessmentSecret, assertAssessmentSecretIsUnique } from '../jwt';

describe('getAssessmentSecret', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...ORIGINAL_ENV };
    });

    afterEach(() => {
        process.env = ORIGINAL_ENV;
    });

    it('returns the secret when ASSESSMENT_JWT_SECRET is set', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a'.repeat(32);
        expect(getAssessmentSecret()).toBe('a'.repeat(32));
    });

    it('throws when ASSESSMENT_JWT_SECRET is not set', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        expect(() => getAssessmentSecret()).toThrow('ASSESSMENT_JWT_SECRET is not set');
    });

    it('does NOT fall back to SUPABASE_JWT_SECRET', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        process.env.SUPABASE_JWT_SECRET = 'supabase-secret-value-that-is-32-chars!!';
        expect(() => getAssessmentSecret()).toThrow('ASSESSMENT_JWT_SECRET is not set');
    });

    it('throws when secret is shorter than 32 characters', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'tooshort';
        expect(() => getAssessmentSecret()).toThrow('too short');
    });

    it('accepts a 32-character secret', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'exactly-32-characters-long-secret!';
        expect(() => getAssessmentSecret()).not.toThrow();
    });
});

describe('encodeAssessmentSecret', () => {
    it('returns a Uint8Array encoding of the secret', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'a'.repeat(32);
        const encoded = encodeAssessmentSecret();
        expect(encoded).toBeInstanceOf(Uint8Array);
        expect(encoded.length).toBeGreaterThan(0);
    });
});

describe('assertAssessmentSecretIsUnique', () => {
    it('does not throw when secrets are different', () => {
        process.env.ASSESSMENT_JWT_SECRET = 'assessment-secret-that-is-32-chars!';
        process.env.SUPABASE_JWT_SECRET = 'supabase-secret-that-is-32-chars!!';
        expect(() => assertAssessmentSecretIsUnique()).not.toThrow();
    });

    it('throws when ASSESSMENT_JWT_SECRET equals SUPABASE_JWT_SECRET', () => {
        const sharedSecret = 'same-secret-shared-between-both-systems!!!';
        process.env.ASSESSMENT_JWT_SECRET = sharedSecret;
        process.env.SUPABASE_JWT_SECRET = sharedSecret;
        expect(() => assertAssessmentSecretIsUnique()).toThrow('same value');
    });

    it('does not throw when either secret is unset', () => {
        delete process.env.ASSESSMENT_JWT_SECRET;
        process.env.SUPABASE_JWT_SECRET = 'supabase-secret-value-32-chars-here!';
        expect(() => assertAssessmentSecretIsUnique()).not.toThrow();
    });
});
