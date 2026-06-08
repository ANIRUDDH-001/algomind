import { describe, it, expect } from 'vitest';

// These tests require the dev server to be running
// They are marked as integration tests and should run in CI with:
// npm run dev & sleep 5 && npx vitest run tests/security/

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function getHeaders(path: string) {
    const res = await fetch(`${BASE_URL}${path}`, { method: 'HEAD', redirect: 'manual' });
    return res.headers;
}

describe('Security Headers', () => {
    it('sets X-Frame-Options: DENY on all pages', async () => {
        const headers = await getHeaders('/');
        expect(headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Content-Type-Options: nosniff', async () => {
        const headers = await getHeaders('/');
        expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('sets Strict-Transport-Security', async () => {
        const headers = await getHeaders('/');
        const hsts = headers.get('Strict-Transport-Security');
        expect(hsts).toContain('max-age=');
        expect(hsts).toContain('includeSubDomains');
    });

    it('sets Referrer-Policy', async () => {
        const headers = await getHeaders('/');
        expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('preserves COEP on /interview', async () => {
        const headers = await getHeaders('/interview');
        expect(headers.get('Cross-Origin-Embedder-Policy')).toBe('require-corp');
    });

    it('sets X-Frame-Options on /assess/:token pages', async () => {
        // Public-facing assessment pages must not be embeddable
        const headers = await getHeaders('/assess/test-token');
        expect(headers.get('X-Frame-Options')).toBe('DENY');
    });
});
