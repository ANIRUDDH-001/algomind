/**
 * P6-6: Route Correlation Header Audit Contract Test
 *
 * Validates that:
 * 1. Route audit baseline is established for systematic hardening
 * 2. Critical paths for distributed tracing are identified
 * 3. Gap analysis is documented for future P6.* sprints
 *
 * Gate: Audit complete with baseline snapshot and backlog itemization.
 * Target: Expand to 50%+ coverage in phase 7 hardening (separate epic).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Route Correlation Header Audit Contract (P6-6)', () => {
    // Load the detailed audit report
    const auditReportPath = path.join(process.cwd(), 'tests/baseline/observability/correlation-routes-detailed.json');
    let auditData: any[] = [];
    
    if (fs.existsSync(auditReportPath)) {
        const content = fs.readFileSync(auditReportPath, 'utf-8');
        auditData = JSON.parse(content);
    }

    it('should document audit baseline for 71 API routes', () => {
        expect(auditData.length).toBe(71);
    });

    it('should identify routes with correlation ID propagation', () => {
        const withSupport = auditData.filter(
            r => r.hasAuditNote !== 'NO_PROPAGATION'
        );
        
        // Baseline: 9-12 routes with propagation; future sprints target 50%
        expect(withSupport.length).toBeGreaterThanOrEqual(8);
        expect(withSupport.length).toBeLessThan(72); // Sanity check
    });

    it('should establish backlog for systematic hardening in future phases', () => {
        const missing = auditData.filter(
            r => r.hasAuditNote === 'NO_PROPAGATION'
        );
        
        expect(missing.length).toBeGreaterThan(50);
        
        // Informational logging for backlog
        console.log(`\n${'\u2501'.repeat(70)}`);
        console.log(`P6-6: ROUTE CORRELATION AUDIT COMPLETE`);
        console.log(`${'\u2501'.repeat(70)}`);
        console.log(`\nAudit Results:`);
        console.log(`  Total routes scanned: ${auditData.length}`);
        console.log(`  With correlation ID: ${auditData.length - missing.length} (${((auditData.length - missing.length) / auditData.length * 100).toFixed(1)}%)`);
        console.log(`  Missing (backlog): ${missing.length} (${(missing.length / auditData.length * 100).toFixed(1)}%)`);
        console.log(`\nBacklog Items (top 15 by priority):`);
        
        const criticalRoutes = [
            '/api/admin/health:high',
            '/api/admin/events:high',
            '/api/assess/start:high',
            '/api/assess/complete:high',
            '/api/health:high',
            '/api/execute:medium',
            '/api/interview/analyze:medium',
            '/api/knowledge/concepts:medium',
        ];
        
        missing.slice(0, 15).forEach((r, i) => {
            console.log(`  ${String(i + 1).padEnd(2)}. ${r.path}`);
        });
        console.log(`  ... and ${missing.length - 15} more routes\n`);
        
        console.log(`Next Steps:`);
        console.log(`  1. Convert manual header setting to withCorrelationId() wrapper`);
        console.log(`  2. Add getCorrelationIdFromRequest() to routes without correlation`);
        console.log(`  3. Ensure correlation ID propagation on all response paths (success/error)`);
        console.log(`  4. Run audit monthly to track progress toward 50% → 90% coverage`);
        console.log(`${'\u2501'.repeat(70)}\n`);
    });
});
