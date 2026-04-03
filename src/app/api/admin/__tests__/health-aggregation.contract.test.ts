import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('admin health aggregation contract', () => {
    const healthRoutePath = path.join(process.cwd(), 'src/app/api/admin/health/route.ts');

    it('aggregates canonical and legacy event taxonomy without schema drift', () => {
        const source = fs.readFileSync(healthRoutePath, 'utf8');

        expect(source).toContain("'db.error' || t === 'db_error'");
        expect(source).toContain("'cron.completed'");
        expect(source).toContain("'cron.failed'");
        expect(source).toContain("'rate_limit.user_exceeded'");
    });

    it('returns stable health payload sections for dashboard consumers', () => {
        const source = fs.readFileSync(healthRoutePath, 'utf8');

        expect(source).toContain('models: modelsSummary');
        expect(source).toContain('events: eventsSummary');
        expect(source).toContain('cron: cronSummary');
        expect(source).toContain('system: {');
        expect(source).toContain('isHealthy');
        expect(source).toContain('alerts');
    });

    it('applies correlation headers on success and error responses', () => {
        const source = fs.readFileSync(healthRoutePath, 'utf8');

        expect(source).toContain('withCorrelationIdResponse(NextResponse.json');
        expect(source).toContain('getCorrelationIdFromRequest(safeRequest)');
    });
});
