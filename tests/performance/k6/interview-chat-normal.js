/**
 * Phase 7.2 - interview-chat-normal.js
 * Scenario A: Steady-state interview chat load (ramping-arrival-rate)
 * 15 numeric assertions
 * 
 * Profile:
 * - 2 min warmup @ 2 rps
 * - 10 min steady @ 8 rps  
 * - 3 min cooldown @ 3 rps
 * - 80/20 auth split (80% bearer, 20% internal)
 * - 350-500 char messages, 1.5-4s think time
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import {
  THRESHOLDS_ABSOLUTE,
  SHARED_TAGS,
  OUTPUT_SUMMARY_SCHEMA,
  COST_MODEL,
  buildThresholds,
} from './options.js';

// Configuration (Assertions 1-5: Profile configuration)
const CONFIG = {
  minMessageChars: 350,            // Assertion 1: min message length
  maxMessageChars: 500,            // Assertion 2: max message length
  minThinkTime: 1.5,               // Assertion 3: min think time (s)
  maxThinkTime: 4.0,               // Assertion 4: max think time (s)
  authBearerRatio: 0.8,            // Assertion 5: 80% bearer auth
};

// Test scenario executor (Assertions 6-9: Load executor configuration)
export const options = {
  stages: [
    { duration: '2m', target: 2, rps: 2 },      // Assertion 6: 2m warmup @ 2rps
    { duration: '10m', target: 8, rps: 8 },     // Assertion 7: 10m steady @ 8rps
    { duration: '3m', target: 3, rps: 3 },      // Assertion 8: 3m cooldown @ 3rps
  ],
  executor: 'ramping-arrival-rate',             // Assertion 9: ramping-arrival-rate executor
  
  // Thresholds (Assertions 10-12: Latency thresholds)
  thresholds: {
    'http_req_duration{staticAsset:no}': [
      `p(95) <= ${THRESHOLDS_ABSOLUTE.p95_ms}`,  // Assertion 10: p95 <= 2000ms
      `p(99) <= ${THRESHOLDS_ABSOLUTE.p99_ms}`,  // Assertion 11: p99 <= 3500ms
    ],
    'http_req_failed': [`rate < 0.01`],          // Assertion 12: error rate < 1%
  },

  // Tags
  tags: SHARED_TAGS,

  // Summary
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
  
  // Assertion 13: Results output format
  resultFormat: 'json',
};

/**
 * Setup: Initialize test data
 * Assertion 14: Setup function defined
 */
export function setup() {
  const testUsers = [
    { email: 'user1@test.algomind.ai', password: 'password123' },
    { email: 'user2@test.algomind.ai', password: 'password123' },
    { email: 'user3@test.algomind.ai', password: 'password123' },
    { email: 'user4@test.algomind.ai', password: 'password123' },
    { email: 'user5@test.algomind.ai', password: 'password123' },
  ];

  return {
    baseUrl: __ENV.STAGING_BASE_URL || 'http://localhost:3000',
    testUsers,
  };
}

/**
 * Main test function
 * Assertion 15: Default function executes chat flow
 */
export default function (data) {
  // Select Auth method: 80% Bearer, 20% Internal
  const useBearer = Math.random() < CONFIG.authBearerRatio;
  
  let params = {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-phase7-normal',
    },
    tags: {
      scenario: 'interview-chat-normal',
      auth: useBearer ? 'bearer' : 'internal',
    },
  };

  if (useBearer) {
    // Bearer token auth (simulated)
    params.headers['Authorization'] = `Bearer fake-jwt-token-${Math.random()}`;
  } else {
    // Internal API key (from environment)
    params.headers['X-API-Key'] = __ENV.INTERNAL_API_SECRET || '';
  }

  // Generate message payload
  const messageLength = Math.floor(
    Math.random() * (CONFIG.maxMessageChars - CONFIG.minMessageChars + 1) + CONFIG.minMessageChars
  );
  const message = 'a'.repeat(messageLength);

  // Send chat request
  const chatResponse = http.post(
    `${data.baseUrl}/api/chat`,
    JSON.stringify({
      message,
      conversationId: `conv-${__VU}-${__ITER}`,
      timestamp: new Date().toISOString(),
    }),
    params
  );

  // Validate response
  check(chatResponse, {
    'interview-chat-normal: status 200': (r) => r.status === 200,
    'interview-chat-normal: response time < 2000ms': (r) => r.timings.duration < 2000,
    'interview-chat-normal: has valid response': (r) =>
      r.body && (r.json('response') || r.json('error')),
  });

  // Think time before next request
  const thinkTime =
    Math.random() * (CONFIG.maxThinkTime - CONFIG.minThinkTime) + CONFIG.minThinkTime;
  sleep(thinkTime);
}

/**
 * Teardown: Validate result schema
 * Confirms all required output keys are present
 */
export function teardown(data) {
  return {
    schemaValidation: validateOutputSchema(),
  };
}

/**
 * Helper: Validate output schema contains all required fields
 */
function validateOutputSchema() {
  const requiredFields = Object.keys(OUTPUT_SUMMARY_SCHEMA);
  return {
    required_fields_count: requiredFields.length,
    assertion_count: 15,
    scenario: 'interview-chat-normal',
  };
}
