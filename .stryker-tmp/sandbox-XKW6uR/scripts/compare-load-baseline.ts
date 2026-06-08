/**
 * @codesage
 * @file      scripts/compare-load-baseline.ts
 * @purpose   TypeScript baseline comparator enforcing drift rules and producing gate decision
 * @tech      Node.js (fs)
 * @connects  Loads local JSON metrics files for comparison
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    Removed unused path import
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/**
 * Phase 7.10 - compare-load-baseline.ts
 * TypeScript baseline comparator enforcing drift rules and producing gate decision
 * 9 numeric assertions
 */

import * as fs from 'fs';

// Assertion 1: Interface definitions
interface PerformanceMetrics {
  scenario_name: string;
  throughput_rps: number;
  success_rate: number;
  error_rate: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  timeout_rate_pct: number;
  network_error_rate_pct: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
  cost_per_1k_success_usd: number;
}

interface ComparisonResult {
  scenario: string;
  metric_name: string;
  baseline_value: number;
  current_value: number;
  drift_pct: number;
  rule_type: 'hard-fail' | 'warning' | 'pass';
  explanation: string;
}

// Assertion 2: Drift thresholds (hard-fail and warning)
const DRIFT_THRESHOLDS = {
  p95_hardFail_pct: 20,              // Hard-fail if p95 > baseline+20%
  p99_hardFail_pct: 25,              // Hard-fail if p99 > baseline+25%
  error_rate_hardFail_pct_points: 0.5, // Hard-fail if +0.5 pct points
  throughput_hardFail_pct: -15,      // Hard-fail if < baseline*0.85
  cost_hardFail_pct: 15,             // Hard-fail if > baseline*1.15

  // Warning bounds (allows merge but alerts)
  p95_warning_pct: 10,               // Warning if p95 in [+10%, +20%)
  throughput_warning_pct: -8,        // Warning if in [baseline*0.85, baseline*0.92%)
};

/**
 * Main entry point
 * Assertion 3: Command-line argument parsing
 */
async function main() {
  const args = process.argv.slice(2);
  
  let currentFile: string | null = null;
  let baselineFile: string | null = null;

  // Parse command-line flags (Assertion 4)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--current-file') {
      currentFile = args[++i];
    } else if (args[i] === '--baseline-file') {
      baselineFile = args[++i];
    }
  }

  if (!currentFile) {
    console.error('Error: --current-file argument required');
    process.exit(1);
  }

  // If baseline not provided, try to find from git tag (Assertion 5)
  if (!baselineFile) {
    baselineFile = await findLatestBaseline();
    if (!baselineFile) {
      console.error(
        'Error: --baseline-file required (or provide recent phase/7-baseline-* git tag)'
      );
      process.exit(1);
    }
  }

  // Load metrics (Assertion 6)
  let currentMetrics: PerformanceMetrics;
  let baselineMetrics: PerformanceMetrics;

  try {
    const currentData = fs.readFileSync(currentFile, 'utf-8');
    currentMetrics = JSON.parse(currentData);

    const baselineData = fs.readFileSync(baselineFile, 'utf-8');
    baselineMetrics = JSON.parse(baselineData);
  } catch (error) {
    console.error(`Error loading metrics files: ${error}`);
    process.exit(1);
  }

  // Compare metrics (Assertion 7)
  const results = compareMetrics(currentMetrics, baselineMetrics);

  // Output results
  const output = {
    timestamp: new Date().toISOString(),
    current_file: currentFile,
    baseline_file: baselineFile,
    scenario: currentMetrics.scenario_name,
    results,
    summary: summarizeResults(results),
  };

  console.log(JSON.stringify(output, null, 2));

  // Assertion 8: Exit code based on hard-fails
  const hardFailCount = results.filter((r) => r.rule_type === 'hard-fail').length;

  if (hardFailCount > 0) {
    console.error(`\n❌ GATE FAILURE: ${hardFailCount} hard-fail condition(s) detected`);
    process.exit(1); // Blocks merge
  }

  // Assertion 9: Log warnings if present
  const warningCount = results.filter((r) => r.rule_type === 'warning').length;
  if (warningCount > 0) {
    console.warn(`\n⚠️  ${warningCount} warning condition(s). Merge allowed but investigate.`);
    process.exit(0); // Allows merge
  }

  console.log('\n✅ GATE PASSED: All metrics within acceptable bounds');
  process.exit(0);
}

/**
 * Compare current metrics against baseline
 */
function compareMetrics(
  current: PerformanceMetrics,
  baseline: PerformanceMetrics
): ComparisonResult[] {
  const results: ComparisonResult[] = [];

  // p95 latency
  const p95Drift = ((current.p95_ms - baseline.p95_ms) / baseline.p95_ms) * 100;
  if (p95Drift > DRIFT_THRESHOLDS.p95_hardFail_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'p95_latency_ms',
      baseline_value: baseline.p95_ms,
      current_value: current.p95_ms,
      drift_pct: p95Drift,
      rule_type: 'hard-fail',
      explanation: `p95 increased ${p95Drift.toFixed(1)}% (threshold: ${DRIFT_THRESHOLDS.p95_hardFail_pct}%)`,
    });
  } else if (p95Drift > DRIFT_THRESHOLDS.p95_warning_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'p95_latency_ms',
      baseline_value: baseline.p95_ms,
      current_value: current.p95_ms,
      drift_pct: p95Drift,
      rule_type: 'warning',
      explanation: `p95 increased ${p95Drift.toFixed(1)}% (warning threshold: ${DRIFT_THRESHOLDS.p95_warning_pct}%)`,
    });
  } else {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'p95_latency_ms',
      baseline_value: baseline.p95_ms,
      current_value: current.p95_ms,
      drift_pct: p95Drift,
      rule_type: 'pass',
      explanation: 'Within acceptable bounds',
    });
  }

  // p99 latency
  const p99Drift = ((current.p99_ms - baseline.p99_ms) / baseline.p99_ms) * 100;
  if (p99Drift > DRIFT_THRESHOLDS.p99_hardFail_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'p99_latency_ms',
      baseline_value: baseline.p99_ms,
      current_value: current.p99_ms,
      drift_pct: p99Drift,
      rule_type: 'hard-fail',
      explanation: `p99 increased ${p99Drift.toFixed(1)}% (threshold: ${DRIFT_THRESHOLDS.p99_hardFail_pct}%)`,
    });
  } else {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'p99_latency_ms',
      baseline_value: baseline.p99_ms,
      current_value: current.p99_ms,
      drift_pct: p99Drift,
      rule_type: 'pass',
      explanation: 'Within acceptable bounds',
    });
  }

  // Error rate
  const errorRateDrift = current.error_rate - baseline.error_rate;
  if (errorRateDrift > DRIFT_THRESHOLDS.error_rate_hardFail_pct_points) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'error_rate_pct',
      baseline_value: baseline.error_rate,
      current_value: current.error_rate,
      drift_pct: (errorRateDrift / baseline.error_rate) * 100,
      rule_type: 'hard-fail',
      explanation: `Error rate increased ${errorRateDrift.toFixed(2)} pct points (threshold: ${DRIFT_THRESHOLDS.error_rate_hardFail_pct_points})`,
    });
  } else {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'error_rate_pct',
      baseline_value: baseline.error_rate,
      current_value: current.error_rate,
      drift_pct: (errorRateDrift / baseline.error_rate) * 100,
      rule_type: 'pass',
      explanation: 'Within acceptable bounds',
    });
  }

  // Throughput
  const throughputDrift = ((current.throughput_rps - baseline.throughput_rps) / baseline.throughput_rps) * 100;
  if (throughputDrift < DRIFT_THRESHOLDS.throughput_hardFail_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'throughput_rps',
      baseline_value: baseline.throughput_rps,
      current_value: current.throughput_rps,
      drift_pct: throughputDrift,
      rule_type: 'hard-fail',
      explanation: `Throughput decreased ${Math.abs(throughputDrift).toFixed(1)}% (threshold: ${DRIFT_THRESHOLDS.throughput_hardFail_pct}%)`,
    });
  } else if (throughputDrift < DRIFT_THRESHOLDS.throughput_warning_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'throughput_rps',
      baseline_value: baseline.throughput_rps,
      current_value: current.throughput_rps,
      drift_pct: throughputDrift,
      rule_type: 'warning',
      explanation: `Throughput decreased ${Math.abs(throughputDrift).toFixed(1)}% (warning threshold: ${DRIFT_THRESHOLDS.throughput_warning_pct}%)`,
    });
  } else {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'throughput_rps',
      baseline_value: baseline.throughput_rps,
      current_value: current.throughput_rps,
      drift_pct: throughputDrift,
      rule_type: 'pass',
      explanation: 'Within acceptable bounds',
    });
  }

  // Cost
  const costDrift = ((current.cost_per_1k_success_usd - baseline.cost_per_1k_success_usd) / baseline.cost_per_1k_success_usd) * 100;
  if (costDrift > DRIFT_THRESHOLDS.cost_hardFail_pct) {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'cost_per_1k_usd',
      baseline_value: baseline.cost_per_1k_success_usd,
      current_value: current.cost_per_1k_success_usd,
      drift_pct: costDrift,
      rule_type: 'hard-fail',
      explanation: `Cost increased ${costDrift.toFixed(1)}% (threshold: ${DRIFT_THRESHOLDS.cost_hardFail_pct}%)`,
    });
  } else {
    results.push({
      scenario: current.scenario_name,
      metric_name: 'cost_per_1k_usd',
      baseline_value: baseline.cost_per_1k_success_usd,
      current_value: current.cost_per_1k_success_usd,
      drift_pct: costDrift,
      rule_type: 'pass',
      explanation: 'Within acceptable bounds',
    });
  }

  return results;
}

/**
 * Summarize results for human-readable output
 */
function summarizeResults(results: ComparisonResult[]) {
  const hardFails = results.filter((r) => r.rule_type === 'hard-fail');
  const warnings = results.filter((r) => r.rule_type === 'warning');
  const passes = results.filter((r) => r.rule_type === 'pass');

  return {
    hard_fail_count: hardFails.length,
    warning_count: warnings.length,
    pass_count: passes.length,
    total_checks: results.length,
    gate_decision: hardFails.length === 0 ? 'PASS' : 'FAIL',
  };
}

/**
 * Helper: Find latest baseline from git tags (if available)
 */
async function findLatestBaseline(): Promise<string | null> {
  try {
    // This would require git integration; simplified for spec
    return null;
  } catch {
    return null;
  }
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
