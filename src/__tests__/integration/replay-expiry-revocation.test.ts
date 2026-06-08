import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe.skip('replay expiry and revocation integration', () => {
    const generateRoutePath = path.join(process.cwd(), 'src/app/api/replay/generate/route.ts');
    const replayPagePath = path.join(process.cwd(), 'src/app/replay/[token]/page.tsx');
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260403_001_replay_ttl_policy.sql');

    it('enforces default replay TTL at write path and DB schema layer', () => {
        const routeSource = fs.readFileSync(generateRoutePath, 'utf8');
        const migrationSource = fs.readFileSync(migrationPath, 'utf8');

        expect(routeSource).toContain('DEFAULT_REPLAY_TTL_DAYS = 30');
        expect(routeSource).toContain('expires_at: expiresAt');

        expect(migrationSource).toContain("ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '30 days')");
        expect(migrationSource).toContain('ALTER COLUMN expires_at SET NOT NULL');
    });

    it('rotates expired public replay token to a fresh token', () => {
        const source = fs.readFileSync(generateRoutePath, 'utf8');

        expect(source).toContain('const isExpired = Boolean(existingReplay.expires_at');
        expect(source).toContain('const rotatedToken = crypto.randomUUID()');
        expect(source).toContain('public_token: rotatedToken');
        expect(source).toContain('expires_at: rotatedExpiresAt');
    });

    it('rejects expired replay links at read boundary', () => {
        const source = fs.readFileSync(replayPagePath, 'utf8');

        expect(source).toContain(".or('expires_at.is.null,expires_at.gte.' + new Date().toISOString())");
    });
});
