import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('replay sharing contract', () => {
    const generateRoutePath = path.join(process.cwd(), 'src/app/api/replay/generate/route.ts');
    const replayPagePath = path.join(process.cwd(), 'src/app/replay/[token]/page.tsx');

    it('sets replay expires_at during generation and returns expiresAt in response payload', () => {
        const source = fs.readFileSync(generateRoutePath, 'utf8');

        expect(source).toContain('expires_at: expiresAt');
        expect(source).toContain('expiresAt');
        expect(source).toContain('DEFAULT_REPLAY_TTL_DAYS = 30');
    });

    it('rotates expired replay token instead of returning stale token', () => {
        const source = fs.readFileSync(generateRoutePath, 'utf8');

        expect(source).toContain('const isExpired = Boolean(existingReplay.expires_at');
        expect(source).toContain('Token rotation failed');
        expect(source).toContain('public_token: rotatedToken');
    });

    it('blocks expired replay retrieval on public replay page query', () => {
        const source = fs.readFileSync(replayPagePath, 'utf8');

        expect(source).toContain(".or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())");
    });
});
