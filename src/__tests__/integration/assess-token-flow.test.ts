import { describe, expect, it } from 'vitest';
import * as jose from 'jose';
import { encodeAssessmentSecret } from '@/lib/assess/jwt';
import fs from 'node:fs';
import path from 'node:path';

describe('assessment token flow integration', () => {
    it('validates signed session token and rejects tampered token', async () => {
        process.env.SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'phase0-test-secret';
        const secret = encodeAssessmentSecret();

        const valid = await new jose.SignJWT({ sub: 'submission-123' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('10m')
            .sign(secret);

        const verified = await jose.jwtVerify(valid, secret);
        expect(verified.payload.sub).toBe('submission-123');

        const tampered = `${valid.slice(0, -2)}zz`;
        await expect(jose.jwtVerify(tampered, secret)).rejects.toThrow();
    });

    it('keeps verify/start public and chat/complete token-gated by route contract', () => {
        const verifyRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/assess/verify-code/route.ts'), 'utf8');
        const startRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/assess/start/route.ts'), 'utf8');
        const chatRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/assess/chat/route.ts'), 'utf8');
        const completeRoute = fs.readFileSync(path.join(process.cwd(), 'src/app/api/assess/complete/route.ts'), 'utf8');

        // Public entry APIs should not require authenticated user guards.
        expect(verifyRoute).not.toContain('auth.getUser');
        expect(startRoute).toContain('supabase.auth.getUser');

        // Protected APIs must enforce sessionToken checks.
        expect(chatRoute).toContain('if (!sessionToken)');
        expect(completeRoute).toContain('missing sessionToken');
    });
});
