import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('correlation propagation contract', () => {
    const middlewarePath = path.join(process.cwd(), 'src/middleware.ts');
    const cronTriggerPath = path.join(process.cwd(), 'src/app/api/cron/trigger/route.ts');
    const adminEventsPath = path.join(process.cwd(), 'src/app/api/admin/events/route.ts');
    const adminHealthPath = path.join(process.cwd(), 'src/app/api/admin/health/route.ts');

    it('middleware injects x-correlation-id into request and response headers', () => {
        const source = fs.readFileSync(middlewarePath, 'utf8');

        expect(source).toContain("requestHeaders.set('x-correlation-id', correlationId)");
        expect(source).toContain("supabaseResponse.headers.set('x-correlation-id', correlationId)");
        expect(source).toContain("response.headers.set('x-correlation-id', correlationId)");
    });

    it('critical cron trigger route wraps all responses with correlation helper', () => {
        const source = fs.readFileSync(cronTriggerPath, 'utf8');

        expect(source).toContain('getCorrelationIdFromRequest(request)');
        expect(source).toContain('withCorrelationIdResponse');
        expect(source).toContain('return withCorrelationIdResponse(NextResponse.json');
    });

    it('admin observability routes propagate correlation headers explicitly', () => {
        const eventsSource = fs.readFileSync(adminEventsPath, 'utf8');
        const healthSource = fs.readFileSync(adminHealthPath, 'utf8');

        expect(eventsSource).toContain('withCorrelationIdResponse');
        expect(eventsSource).toContain('getCorrelationIdFromRequest(safeRequest)');

        expect(healthSource).toContain('withCorrelationIdResponse');
        expect(healthSource).toContain('getCorrelationIdFromRequest(safeRequest)');
    });
});
