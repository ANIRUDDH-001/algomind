import fs from 'node:fs';
import path from 'node:path';

type Check = {
    name: string;
    pass: boolean;
    details: string;
};

function read(filePath: string): string {
    return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

function runChecks(): Check[] {
    const checks: Check[] = [];

    const vercel = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> };
    const cronCount = vercel.crons?.length ?? 0;
    checks.push({
        name: 'single-vercel-cron-free-tier',
        pass: cronCount === 1 && vercel.crons?.[0]?.path === '/api/cron/trigger',
        details: `crons=${cronCount}, primary=${vercel.crons?.[0]?.path ?? 'none'}`,
    });

    const eventsSource = read('src/lib/monitoring/events.ts');
    checks.push({
        name: 'deterministic-sampling-enabled',
        pass: eventsSource.includes('shouldSampleEvent') && eventsSource.includes('stableSampleScore'),
        details: 'events.ts contains deterministic hash sampling',
    });

    const cronRoute = read('src/app/api/cron/trigger/route.ts');
    checks.push({
        name: 'cron-trigger-correlation-and-lifecycle',
        pass: cronRoute.includes('withCorrelationIdResponse') && cronRoute.includes('logSystemLifecycle'),
        details: 'cron route wraps responses and logs lifecycle',
    });

    const edgeFn = read('supabase/functions/review-reminders/index.ts');
    checks.push({
        name: 'edge-review-reminders-canonical-events',
        pass: edgeFn.includes('edge.review_reminders_queued') && edgeFn.includes('edge.review_reminders_failed'),
        details: 'edge function emits canonical edge.* events',
    });

    const retentionScriptExists = fs.existsSync(path.join(process.cwd(), 'scripts/enforce-observability-retention.ts'));
    checks.push({
        name: 'retention-policy-script-present',
        pass: retentionScriptExists,
        details: 'scripts/enforce-observability-retention.ts',
    });

    const auditPath = path.join(process.cwd(), 'tests/baseline/observability/correlation-routes-detailed.json');
    const hasAudit = fs.existsSync(auditPath);
    checks.push({
        name: 'route-correlation-audit-baseline',
        pass: hasAudit,
        details: hasAudit ? 'baseline JSON exists' : 'missing baseline JSON',
    });

    return checks;
}

function main() {
    const checks = runChecks();
    const failed = checks.filter((c) => !c.pass);

    console.log('\nPhase 6 Observability Simulation');
    console.log('=================================');

    for (const check of checks) {
        console.log(`${check.pass ? 'PASS' : 'FAIL'}  ${check.name} :: ${check.details}`);
    }

    console.log('---------------------------------');
    console.log(`Result: ${checks.length - failed.length}/${checks.length} checks passed`);

    if (failed.length > 0) {
        process.exit(1);
    }
}

main();
