import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('owner analytics schema contract', () => {
    const analyticsTabPath = path.join(process.cwd(), 'src/app/owner/tabs/analytics-tab.tsx');
    const overviewTabPath = path.join(process.cwd(), 'src/app/owner/tabs/overview-tab.tsx');

    it('consumes canonical analytics row shape with type field', () => {
        const source = fs.readFileSync(analyticsTabPath, 'utf8');

        expect(source).toContain('interface AnalyticsRow');
        expect(source).toContain('type: string;');
        expect(source).toContain('dayData[curr.type] = curr.count;');
        expect(source).not.toContain('event_type: string');
    });

    it('supports canonical event names in visual mappings and cron health', () => {
        const source = fs.readFileSync(analyticsTabPath, 'utf8');

        expect(source).toContain("'cron_completed'");
        expect(source).toContain("'cron_failed'");
        expect(source).toContain("'batch_job_complete'");
    });

    it('renders recent events using canonical type field in overview tab', () => {
        const source = fs.readFileSync(overviewTabPath, 'utf8');

        expect(source).toContain('{event.type}');
        expect(source).not.toContain('{event.event_type}');
    });
});
