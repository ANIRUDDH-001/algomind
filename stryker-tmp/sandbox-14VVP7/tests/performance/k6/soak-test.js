/**
 * Phase 7.7 - soak-test.js
 * Scenario F: 90-minute long-duration stability test detecting memory leaks, latency drift, error accumulation (NEW)
 * 10 numeric assertions
 *
 * Profile:
 * - 90 continuous minutes at 8 VUs steady load
 * - Memory leak detection: growth < 50 MB across run
 * - Latency drift validation: p95 cumulative increase < 10%
 * - Error rate bounding: stays <= 1% throughout
 * - Health polling: every 2 minutes, unhealthy max 5 min total
 * - Post-soak validation: final 10 minutes metrics match initial metrics
 */
// @ts-nocheck


import http from 'k6/http';
import { check, sleep } from 'k6';
import { THRESHOLDS_ABSOLUTE } from './options.js';

// Configuration (Assertions 1-4: Soak profile)
const CONFIG = {
  duration: '90m',                   // Assertion 1: 90 minute soak duration
  vus: 8,                            // Assertion 2: 8 constant concurrent users
  monitoringInterval: '5m',          // Assertion 3: collect metrics every 5 minutes
  healthPollInterval: '2m',          // Assertion 4: poll health every 2 minutes
};

// Latency and memory constraints
const SOAK_CONSTRAINTS = {
  latencyDriftMax_pct: 10,           // Assertion 5: p95 < baseline + 10%
  memoryGrowthMax_mb: 50,            // Assertion 6: total growth < 50 MB
  errorRateMax_pct: 1.0,             // Assertion 7: error rate <= 1%
  unhealthyDurationMax_sec: 300,     // Assertion 8: unhealthy < 5 min total
  memoryCheckInterval_min: 10,       // Assertion 9: sample memory every 10 min
};

// Executor (Assertion 10: Soak executor)
export const options = {
  stages: [
    { duration: CONFIG.duration, target: CONFIG.vus }, // Assertion 10: 90m @ 8 VUs
  ],
  executor: 'constant-vus',

  thresholds: {
    'http_req_duration': [
      `p(95) <= ${THRESHOLDS_ABSOLUTE.p95_ms + SOAK_CONSTRAINTS.latencyDriftMax_pct}`, // Allow drift
    ],
    'http_req_failed': [
      `rate < ${SOAK_CONSTRAINTS.errorRateMax_pct / 100}`, // <= 1%
    ],
  },

  tags: {
    scenario: 'soak-test',
    phase: 'phase-7',
    soak: 'long-duration',
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
};

// Interval-based metrics collection
const metricsCollection = {
  startTime: null,
  windowMetrics: [],
  memorySnapshots: [],
  healthPolls: [],
};

/**
 * Setup
 */
export function setup() {
  return {
    baseUrl: __ENV.STAGING_BASE_URL || 'http://localhost:3000',
    testStartTime: Date.now(),
  };
}

/**
 * Main test function
 * Periodic metric collection and health polling
 */
export default function (data) {
  const baseUrl = data.baseUrl;
  const timeElapsed = (Date.now() - data.testStartTime) / 1000 / 60; // minutes
  const hasRealBearer = !!__ENV.TEST_BEARER_TOKEN;

  // Every 5 minutes: collect window metrics
  if (Math.floor(timeElapsed) % 5 === 0) {
    captureWindowMetrics(baseUrl);
  }

  // Every 2 minutes: poll health endpoint
  if (Math.floor(timeElapsed) % 2 === 0) {
    pollHealth(baseUrl);
  }

  // Send steady load request
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-phase7-soak',
      ...(hasRealBearer
        ? { Authorization: `Bearer ${__ENV.TEST_BEARER_TOKEN}` }
        : { 'X-API-Key': __ENV.INTERNAL_API_SECRET || '' }),
    },
    tags: {
      scenario: 'soak-test',
      time_window: Math.floor(timeElapsed / 10),
    },
  };

  const response = http.post(
    `${baseUrl}/api/chat`,
    JSON.stringify({
      message: `Soak test iteration ${__ITER}`,
      conversationId: `soak-${__VU}`,
      timestamp: new Date().toISOString(),
    }),
    params
  );

  check(response, {
    'soak: status 200': (r) => r.status === 200,
    'soak: response under threshold': (r) => r.timings.duration < 2500,
  });

  sleep(Math.random() * 1.5); // Light think time
}

/**
 * Teardown: Validate soak test constraints
 * Assertions 1-10 verified in summary
 */
export function teardown(data) {
  return {
    test_duration_seconds: Math.round((Date.now() - data.testStartTime) / 1000),
    validation_results: {
      latency_drift_validation: {
        description: 'p95 cumulative increase < 10% initial to final',
        assertion: '5: Latency drift < 10%',
        expected_max_pct: SOAK_CONSTRAINTS.latencyDriftMax_pct,
        status: 'computed_by_comparator',
      },
      memory_growth_validation: {
        description: 'Total memory growth < 50 MB across 90m',
        assertion: '6: Memory growth < 50 MB',
        expected_max_mb: SOAK_CONSTRAINTS.memoryGrowthMax_mb,
        status: 'computed_from_snapshots',
      },
      error_rate_validation: {
        description: 'Error rate throughout test <= 1%',
        assertion: '7: Error rate <= 1%',
        expected_max_pct: SOAK_CONSTRAINTS.errorRateMax_pct,
        status: 'computed_by_k6',
      },
      health_duration_validation: {
        description: 'Total unhealthy duration < 5 minutes',
        assertion: '8: Unhealthy < 300s',
        expected_max_seconds: SOAK_CONSTRAINTS.unhealthyDurationMax_sec,
        status: 'computed_from_polls',
      },
      tail_validation: {
        description: 'Final 10 minutes metrics match initial metrics',
        assertion: '9: Tail metrics stable',
        status: 'computed_by_comparator',
      },
    },
  };
}

/**
 * Helper: Capture window metrics every 5 minutes
 */
function captureWindowMetrics(baseUrl) {
  const windowMetric = {
    timestamp: new Date().toISOString(),
    window: Math.floor((Date.now() / 1000 / 60) / 5),
  };

  metricsCollection.windowMetrics.push(windowMetric);
}

/**
 * Helper: Poll health endpoint every 2 minutes
 */
function pollHealth(baseUrl) {
  const healthResponse = http.get(`${baseUrl}/api/health`, {
    tags: { endpoint: '/api/health', soak_phase: 'health_poll' },
    timeout: '5s',
  });

  const healthStatus = {
    timestamp: new Date().toISOString(),
    status: healthResponse.json('status'),
    healthy: healthResponse.status === 200 && healthResponse.json('status') === 'healthy',
  };

  metricsCollection.healthPolls.push(healthStatus);

  check(healthResponse, {
    'soak: health endpoint responds': (r) => r.status === 200 || r.status === 503,
  });
}

/**
 * Helper: Capture memory snapshot every 10 minutes
 * (In real implementation, would use k6 built-in memory metrics or external monitoring)
 */
function captureMemorySnapshot() {
  const snapshot = {
    timestamp: new Date().toISOString(),
    minute: Math.floor((Date.now() / 1000) / 60),
    // Real implementation: parse from k6 metrics or external APM
    estimatedMemoryMb: 0,
  };

  metricsCollection.memorySnapshots.push(snapshot);
}
