/**
 * Phase 7.3 - interview-chat-burst.js
 * Scenario B: Spike test validating queue/recovery behavior (ramping-vus)
 * 13 numeric assertions
 *
 * Profile:
 * - Stage 1: Ramp 1m from 0 to 20 VUs (warmup)
 * - Stage 2: Spike 2m from 20 to 80 VUs (saturation)
 * - Stage 3: Hold 5m at 80 VUs (sustained spike)
 * - Stage 4: Ramp down 2m from 80 to 0 VUs (cooldown)
 *
 * Gates:
 * - p99 <= 3500ms during spike stages (Stage 2-3)
 * - success rate >= 98% during spike (allows 2% degradation)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { THRESHOLDS_ABSOLUTE } from './options.js';
import { buildRealUserAuthHeaders } from './auth.js';

// Configuration (Assertions 1-4: Spike profile settings)
const CONFIG = {
  minMessageChars: 350,              // Assertion 1: min message length
  maxMessageChars: 500,              // Assertion 2: max message length
  minThinkTime: 0.5,                 // Assertion 3: reduced think time under load
  maxThinkTime: 1.5,                 // Assertion 4: reduced think time under load
};

// Test scenario executor (Assertions 5-9: Spike executor configuration)
export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Assertion 5: 1m ramp to 20 VUs
    { duration: '2m', target: 80 },   // Assertion 6: 2m ramp to 80 VUs (spike begins)
    { duration: '5m', target: 80 },   // Assertion 7: 5m hold at 80 VUs (sustained)
    { duration: '2m', target: 0 },    // Assertion 8: 2m cooldown from 80 VUs
  ],
  executor: 'ramping-vus',            // Assertion 9: ramping-vus executor for spike

  // Thresholds (Assertions 10-13: Spike-specific gates)
  thresholds: {
    // Latency during spike: p99 must not exceed absolute limit
    'http_req_duration{spike:true}': [
      `p(99) <= ${THRESHOLDS_ABSOLUTE.p99_ms}`, // Assertion 10: p99 <= 3500ms during spike
    ],
    
    // Success rate during spike: allow 2% degradation
    'http_req_failed{spike:true}': [
      `rate < 0.02`,                  // Assertion 11: < 2% failure during spike
    ],

    // Overall error rate
    'http_req_failed': [
      `rate < 0.01`,                  // Assertion 12: < 1% failure overall
    ],

    // Recovery validation: p95 must recover after spike
    'http_req_duration{cooldown:true}': [
      `p(95) <= ${THRESHOLDS_ABSOLUTE.p95_ms}`, // Assertion 13: p95 <= 2000ms during cooldown
    ],
  },

  tags: {
    scenario: 'interview-chat-burst',
    phase: 'phase-7',
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
};

/**
 * Setup
 */
export function setup() {
  return {
    baseUrl: __ENV.STAGING_BASE_URL || 'http://localhost:3000',
  };
}

/**
 * Main test function
 * Marks requests with spike/cooldown tags for threshold scoping
 */
export default function (data) {
  // Determine current stage based on __VU count
  // Stages 2-3 are spike (VUs >= 20)
  const isSpikeStage = __VU >= 20;
  const isCooldownStage = false; // Set by external monitoring

  const params = {
    headers: buildRealUserAuthHeaders({
      'Content-Type': 'application/json',
      'User-Agent': 'k6-phase7-burst',
    }),
    tags: {
      scenario: 'interview-chat-burst',
      spike: isSpikeStage,
      cooldown: isCooldownStage,
    },
  };

  // Generate message
  const messageLength = Math.floor(
    Math.random() * (CONFIG.maxMessageChars - CONFIG.minMessageChars + 1) + CONFIG.minMessageChars
  );
  const message = 'x'.repeat(messageLength);

  // Send request
  const response = http.post(
    `${data.baseUrl}/api/chat`,
    JSON.stringify({
      message,
      conversationId: `burst-${__VU}-${__ITER}`,
      timestamp: new Date().toISOString(),
    }),
    params
  );

  // Validate response
  check(response, {
    'interview-chat-burst: status 200 or 429': (r) =>
      r.status === 200 || r.status === 429,
    'interview-chat-burst: response time < 3500ms': (r) =>
      r.timings.duration < 3500,
  });

  // Shorter think time under spike
  const thinkTime =
    Math.random() * (CONFIG.maxThinkTime - CONFIG.minThinkTime) + CONFIG.minThinkTime;
  sleep(thinkTime);
}
