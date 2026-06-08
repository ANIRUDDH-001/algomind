import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe.skip('schema contract drift', () => {
    const migrationReadmePath = path.join(process.cwd(), 'supabase/migrations/README.md');
    const replayTtlMigrationPath = path.join(process.cwd(), 'supabase/migrations/20260403_001_replay_ttl_policy.sql');
    const supabaseTypesPath = path.join(process.cwd(), 'src/types/supabase.ts');

    it('tracks replay TTL migration in migration inventory', () => {
        const readme = fs.readFileSync(migrationReadmePath, 'utf8');

        expect(readme).toContain('20260403_001_replay_ttl_policy.sql');
    });

    it('migration enforces non-null expiry contract', () => {
        const migration = fs.readFileSync(replayTtlMigrationPath, 'utf8');

        expect(migration).toContain('ALTER COLUMN expires_at SET NOT NULL');
        expect(migration).toContain('ALTER COLUMN expires_at SET DEFAULT');
    });

    it('generated supabase type contract reflects non-null replay expires_at', () => {
        const types = fs.readFileSync(supabaseTypesPath, 'utf8');

        const sessionReplayBlock = types.slice(types.indexOf('session_replays:'), types.indexOf('skill_repetition:'));
        expect(sessionReplayBlock).toContain('expires_at: string');
        expect(sessionReplayBlock).not.toContain('expires_at: string | null');
    });
});
