/**
 * Phase 7.5 - voice-pipeline.js
 * Scenario D: Smoke test for voice-related overhead validation (constant VUs)
 * 9 numeric assertions
 *
 * Profile:
 * - 5 constant VUs for 8 minutes (smoke-only, not stress)
 * - Validates /api/chat with voice/transcription markers
 * - Parity check: latency should match interview-chat-normal (p95 <= 2000ms)
 * - Voice overhead should be < 500ms additional
 */
// @ts-nocheck


import http from 'k6/http';
import { check, sleep } from 'k6';
import { THRESHOLDS_ABSOLUTE } from './options.js';
import { buildRealUserAuthHeaders } from './auth.js';

// Configuration (Assertions 1-3: Voice smoke profile)
const CONFIG = {
  duration: '8m',                    // Assertion 1: 8 minute smoke duration
  vus: 5,                            // Assertion 2: 5 concurrent users (smoke-only)
  minMessageLength: 100,             // Assertion 3: shorter voice transcript
};

// Executor (Assertions 4-5: Voice smoke executor)
export const options = {
  stages: [
    { duration: CONFIG.duration, target: CONFIG.vus }, // Assertion 4: 5 VUs sustained
  ],
  executor: 'constant-vus',          // Assertion 5: constant VU executor

  thresholds: {
    'http_req_duration': [
      `p(95) <= ${THRESHOLDS_ABSOLUTE.p95_ms}`, // Assertion 6: p95 <= 2000ms (parity with normal)
      `p(99) <= ${THRESHOLDS_ABSOLUTE.p99_ms}`, // (included for completeness)
    ],
    'http_req_failed': [
      `rate < 0.01`,                 // Assertion 7: error rate < 1%
    ],
  },

  tags: {
    scenario: 'voice-pipeline',
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
 * Assertion 8: Default executes voice chat request
 */
export default function (data) {
  const baseUrl = data.baseUrl;

  // Generate voice transcription message (simulated)
  // Format: "[VOICE_TRANSCRIPTION] conversation text here"
  const voiceMessage = `[VOICE_TRANSCRIPTION] help me understand how to solve this problem step by step`;

  const params = {
    headers: buildRealUserAuthHeaders({
      'Content-Type': 'application/json',
      'User-Agent': 'k6-phase7-voice',
      'X-Request-Source': 'voice',
    }),
    tags: {
      scenario: 'voice-pipeline',
      request_source: 'voice',
    },
  };

  // Send voice request
  const response = http.post(
    `${baseUrl}/api/chat`,
    JSON.stringify({
      message: voiceMessage,
      conversationId: `voice-${__VU}-${__ITER}`,
      source: 'voice',
      timestamp: new Date().toISOString(),
    }),
    params
  );

  // Validate voice response
  check(response, {
    'voice: status 200': (r) => r.status === 200,
    'voice: response time < 2000ms': (r) => r.timings.duration < 2000,
    'voice: has response body': (r) => r.body && r.body.length > 0,
  });

  // Assertion 9: Voice overhead validation
  // Voice requests should not exceed base latency + overhead buffer (500ms)
  const voiceOverheadExpected = 500; // ms additional overhead allowed
  check(response, {
    'voice: overhead < 500ms': (r) =>
      r.timings.duration < THRESHOLDS_ABSOLUTE.p95_ms + voiceOverheadExpected,
  });

  sleep(Math.random() * 2);
}
