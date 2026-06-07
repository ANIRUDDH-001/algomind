import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('system events contract', () => {
    const adminEventsRoutePath = path.join(process.cwd(), 'src/app/api/admin/events/route.ts');
    const ownerAnalyticsTabPath = path.join(process.cwd(), 'src/app/owner/tabs/analytics-tab.tsx');
    const ownerOverviewTabPath = path.join(process.cwd(), 'src/app/owner/overview/OverviewClient.tsx');

    it('uses canonical type field in admin analytics aggregation payload', () => {
        const source = fs.readFileSync(adminEventsRoutePath, 'utf8');

        expect(source).toContain('interface AnalyticsRow { event_date: string; type: string; count: number; }');
        expect(source).toContain('type: evt.type as string');
        expect(source).not.toContain('event_type: evt.type as string');
    });

    it('owner analytics tab reads analytics rows from type field', () => {
        const source = fs.readFileSync(ownerAnalyticsTabPath, 'utf8');

        expect(source).toContain('type: string;');
        expect(source).toContain('dayData[curr.type] = curr.count;');
        expect(source).toContain('.map(a => a.type)');
        expect(source).not.toContain('event_type: string;');
    });

    it('owner overview tab renders recent event type from canonical field', () => {
        const source = fs.readFileSync(ownerOverviewTabPath, 'utf8');

        expect(source).toContain('e.type ===');
        expect(source).not.toContain('e.event_type ===');
    });
});
