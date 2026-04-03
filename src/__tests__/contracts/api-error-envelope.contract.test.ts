import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('api error envelope contract', () => {
    const replayGenerateRoutePath = path.join(process.cwd(), 'src/app/api/replay/generate/route.ts');

    it('replay generate route uses canonical error-response helper and error codes', () => {
        const source = fs.readFileSync(replayGenerateRoutePath, 'utf8');

        expect(source).toContain("from '@/lib/api/error-response'");
        expect(source).toContain('apiError(');
        expect(source).toContain('ErrorCodes.UNAUTHORIZED');
        expect(source).toContain('ErrorCodes.MISSING_FIELD');
        expect(source).toContain('ErrorCodes.INTERNAL_ERROR');
    });

    it('preserves correlation id header on error responses', () => {
        const source = fs.readFileSync(replayGenerateRoutePath, 'utf8');

        expect(source).toContain('withCorrelationIdHeaders');
        expect(source).toContain('headers: Object.fromEntries(withCorrelationIdHeaders(undefined, correlationId).entries())');
    });
});
