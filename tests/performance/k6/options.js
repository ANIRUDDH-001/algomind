/**
 * Phase 7 - options.js
 * Shared k6 configuration with dual-mode thresholds and executor defaults
 * 16 numeric assertions (Phase 7.1)
 */

/**
 * THRESHOLDS_ABSOLUTE
 * Initial baseline calibration thresholds (all scenarios must pass on first run)
 * Used to establish system baseline before relative gating is applied
 * Assertion 1-8: Absolute thresholds with specific numeric bounds
 */
export const THRESHOLDS_ABSOLUTE = {
  // Latency bounds (ms)
  p50_ms: 600,                    // Assertion 1: p50 median under 600ms
  p95_ms: 2000,                   // Assertion 2: p95 percentile under 2000ms
  p99_ms: 3500,                   // Assertion 3: p99 percentile under 3500ms
  p50_p95_spread_max_ms: 400,     // Assertion 4: percentile spread validation (p95-p50 < 400ms)

  // Success and error rates
  success_rate_min_pct: 99.0,     // Assertion 5: minimum 99% success
  error_rate_max_pct: 1.0,        // Assertion 6: maximum 1% errors
  timeout_rate_max_pct: 0.3,      // Assertion 7: timeout failures under 0.3%
  network_error_rate_max_pct: 0.2, // Assertion 8: network errors under 0.2%
};

/**
 * THRESHOLDS_BASELINE_RELATIVE
 * Ongoing gating thresholds relative to approved baseline
 * Applied to all subsequent runs after baseline is established
 * Assertion 9-13: Relative thresholds with hard-fail/warning bands
 */
export const THRESHOLDS_BASELINE_RELATIVE = {
  // Hard-fail conditions (blocks merge)
  p95_hardFail_pct: 20,           // Assertion 9: p95 > baseline+20% = HARD FAIL
  p99_hardFail_pct: 25,           // Assertion 10: p99 > baseline+25% = HARD FAIL
  error_rate_hardFail_pct_points: 0.5, // Assertion 11: error +0.5 pct points = HARD FAIL
  throughput_hardFail_pct: -15,   // Assertion 12: throughput < baseline×0.85 = HARD FAIL
  cost_hardFail_pct: 15,          // Assertion 13: cost > baseline×1.15 = HARD FAIL

  // Warning conditions (logged but allows merge)
  p95_warning_pct: 10,            // p95 in [baseline+10%, baseline+20%) = WARNING
  throughput_warning_pct: -8,     // throughput in [baseline×0.85, baseline×0.92%) = WARNING
};

/**
 * SHARED_TAGS
 * Common tags applied to all requests for correlation and filtering
 * Assertion 14: tag structure defined
 */
export const SHARED_TAGS = {
  phase: 'phase-7',
  env: `${__ENV.ENVIRONMENT || 'staging'}`,
  branch: `${__ENV.GIT_BRANCH || 'unknown'}`,
  timestamp: new Date().toISOString(),
};

/**
 * EXECUTOR_DEFAULTS
 * k6 executor configuration shared across scenarios
 * Assertion 15-16: Executor defaults configured
 */
export const EXECUTOR_DEFAULTS = {
  // Timeouts
  handleSummary: undefined,       // Assertion 15: summary config placeholder
  
  // Connection defaults
  http: {
    timeout: '30s',
    setResponseCallback: undefined,
  },

  // Batch defaults
  batch: {
    maxBatchSize: 20,             // Assertion 16: batch size configured
  },
};

/**
 * OUTPUT_SUMMARY_SCHEMA
 * Keys that must appear in final k6 summary JSON output
 * Validates comparator can parse run results
 */
export const OUTPUT_SUMMARY_SCHEMA = {
  // Scenario metadata
  scenario_name: String,            // Scenario identifier
  scenario_duration_seconds: Number, // Total run duration
  scenario_vus_max: Number,          // Peak virtual users
  
  // Success/failure metrics
  success_count: Number,
  fail_count: Number,
  success_rate_pct: Number,
  error_rate_pct: Number,
  timeout_count: Number,
  timeout_rate_pct: Number,
  network_error_count: Number,
  network_error_rate_pct: Number,

  // Latency metrics (ms)
  latency_min_ms: Number,
  latency_max_ms: Number,
  latency_avg_ms: Number,
  latency_p50_ms: Number,
  latency_p95_ms: Number,
  latency_p99_ms: Number,
  latency_p50_p95_spread_ms: Number, // NEW: percentile spread detection

  // Throughput
  throughput_rps: Number,

  // Token metrics (NEW: cost distribution tracking)
  avg_input_tokens: Number,
  avg_output_tokens: Number,
  max_tokens_single_request: Number,
  token_cost_stddev: Number,

  // Health metrics (NEW: duration-based health validation)
  health_unhealthy_duration_total_seconds: Number,
  health_max_consecutive_unhealthy_polls: Number,
  
  // Cost metrics
  cost_per_1k_success_usd: Number,
};

/**
 * Utility: Build k6 threshold objects for comparator integration
 * Returns threshold configuration with assertion names for reporting
 */
export function buildThresholds(thresholdMode = 'absolute', baselineOverrides = {}) {
  const base = thresholdMode === 'absolute' ? THRESHOLDS_ABSOLUTE : THRESHOLDS_BASELINE_RELATIVE;
  const merged = { ...base, ...baselineOverrides };
  
  return {
    thresholds: merged,
    mode: thresholdMode,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Health polling configuration
 * Used by CI workflow and soak test monitoring
 */
export const HEALTH_POLLING_CONFIG = {
  interval_seconds: 30,
  timeout_seconds: 5,
  unhealthy_threshold_consecutive: 3, // Fail if 3+ consecutive unhealthy
  unhealthy_threshold_duration_seconds: 60, // Fail if >60s total unhealthy
  endpoint: `/api/health`,
};

/**
 * Cost model configuration
 */
export const COST_MODEL = {
  input_cost_per_1k_tokens_usd: 0.01,
  output_cost_per_1k_tokens_usd: 0.03,
  base_api_cost_per_request_usd: 0.001,
};

export default {
  THRESHOLDS_ABSOLUTE,
  THRESHOLDS_BASELINE_RELATIVE,
  SHARED_TAGS,
  EXECUTOR_DEFAULTS,
  OUTPUT_SUMMARY_SCHEMA,
  buildThresholds,
  HEALTH_POLLING_CONFIG,
  COST_MODEL,
};
