import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('admin user management endpoint contract', () => {
    const filePath = path.join(process.cwd(), 'src/lib/api/adapters/employer-admin-adapter.ts');

    it('uses owner users endpoint and does not reference missing admin users endpoint', () => {
        const source = fs.readFileSync(filePath, 'utf8');

        expect(source).toContain("'/api/owner/users'");
        expect(source).not.toContain('/api/admin/users');
    });

    it('uses userId-based PATCH payload for mutations', () => {
        const source = fs.readFileSync(filePath, 'utf8');

        expect(source).toContain('userId');
        expect(source).toContain("accountType: 'candidate' | 'employer'");
        expect(source).toContain("requestVoid('/api/owner/users'");
    });
});
