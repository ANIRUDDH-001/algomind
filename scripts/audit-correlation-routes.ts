/**
 * P6-6: Route Correlation Header Audit
 *
 * Scans all Next.js API routes to identify which ones properly propagate
 * x-correlation-id response headers.
 *
 * Usage: npx ts-node scripts/audit-correlation-routes.ts
 */

import fs from 'fs';
import path from 'path';

interface RouteAudit {
    path: string;
    hasCorrelationImport: boolean;
    usesWithCorrelationId: boolean;
    usesWithCorrelationIdHeaders: boolean;
    hasManualHeaderSet?: boolean;
    hasAuditNote: string;
}

const apiDir = path.join(process.cwd(), 'src/app/api');
const routes: RouteAudit[] = [];

function walkDir(dir: string, baseRoute = '/api'): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const route = baseRoute + (entry.name === 'route.ts' ? '' : '/' + entry.name);

        if (entry.isDirectory()) {
            walkDir(fullPath, route);
        } else if (entry.name === 'route.ts') {
            const content = fs.readFileSync(fullPath, 'utf-8');
            
            const hasCorrelationImport = 
                content.includes('withCorrelationId') || 
                content.includes('getCorrelationIdFromRequest') ||
                content.includes('getCorrelationId()');
            
            const usesWithCorrelationId = 
                content.includes('withCorrelationId<') ||
                content.includes('withCorrelationId(');
            
            const usesWithCorrelationIdHeaders = 
                content.includes('withCorrelationIdHeaders');
            
            // Check for manual correlation ID propagation (headers.set('x-correlation-id', ...))
            const hasManualHeaderSet = 
                content.includes("headers.set('x-correlation-id'") ||
                content.includes('headers.set("x-correlation-id"');
            
            // Route has correlation if it uses wrapper, headers helper, or manual header setting
            const hasPropagation = usesWithCorrelationId || usesWithCorrelationIdHeaders || hasManualHeaderSet;
            
            let auditNote = '';
            if (!hasPropagation) {
                auditNote = 'NO_PROPAGATION';
            } else if (usesWithCorrelationId) {
                auditNote = 'USES_RESPONSE_WRAPPER';
            } else if (usesWithCorrelationIdHeaders) {
                auditNote = 'USES_HEADERS';
            } else if (hasManualHeaderSet) {
                auditNote = 'USES_MANUAL_HEADER';
            }
            
            routes.push({
                path: route,
                hasCorrelationImport,
                usesWithCorrelationId,
                usesWithCorrelationIdHeaders,
                hasManualHeaderSet,
                hasAuditNote: auditNote,
            });
        }
    }
}

walkDir(apiDir);

// Sort by route path
routes.sort((a, b) => a.path.localeCompare(b.path));

// Generate report
console.log('═══════════════════════════════════════════════════════════════════');
console.log('P6-6: ROUTE CORRELATION HEADER AUDIT');
console.log('═══════════════════════════════════════════════════════════════════\n');

const grouped = {
    USES_RESPONSE_WRAPPER: routes.filter(r => r.hasAuditNote === 'USES_RESPONSE_WRAPPER'),
    USES_HEADERS: routes.filter(r => r.hasAuditNote === 'USES_HEADERS'),
    USES_MANUAL_HEADER: routes.filter(r => r.hasAuditNote === 'USES_MANUAL_HEADER'),
    NO_PROPAGATION: routes.filter(r => r.hasAuditNote === 'NO_PROPAGATION'),
};

console.log(`✅ PROPER CORRELATION ID PROPAGATION (${grouped.USES_RESPONSE_WRAPPER.length}):`);
grouped.USES_RESPONSE_WRAPPER.forEach(r => console.log(`   ${r.path}`));

console.log(`\n✅ USES HEADERS HELPER (${grouped.USES_HEADERS.length}):`);
grouped.USES_HEADERS.forEach(r => console.log(`   ${r.path}`));

console.log(`\n✅ MANUAL HEADER PROPAGATION (${grouped.USES_MANUAL_HEADER.length}):`);
grouped.USES_MANUAL_HEADER.forEach(r => console.log(`   ${r.path}`));

console.log(`\n🔴 NO CORRELATION ID (${grouped.NO_PROPAGATION.length}):`);
grouped.NO_PROPAGATION.slice(0, 20).forEach(r => console.log(`   ${r.path}`));
if (grouped.NO_PROPAGATION.length > 20) {
    console.log(`   ... and ${grouped.NO_PROPAGATION.length - 20} more`);
}

console.log(`\n═══════════════════════════════════════════════════════════════════`);
console.log(`SUMMARY:`);
const withPropagation = grouped.USES_RESPONSE_WRAPPER.length + grouped.USES_HEADERS.length + grouped.USES_MANUAL_HEADER.length;
console.log(`  Total routes: ${routes.length}`);
console.log(`  With propagation: ${withPropagation} (${(withPropagation / routes.length * 100).toFixed(1)}%)`);
console.log(`  Missing: ${grouped.NO_PROPAGATION.length} (${(grouped.NO_PROPAGATION.length / routes.length * 100).toFixed(1)}%)`);
console.log(`═══════════════════════════════════════════════════════════════════\n`);

// Save detailed report
const reportPath = path.join(process.cwd(), 'tests/baseline/observability/correlation-routes-detailed.json');
fs.writeFileSync(reportPath, JSON.stringify(routes, null, 2));
console.log(`✅ Detailed report saved to: ${reportPath}`);
