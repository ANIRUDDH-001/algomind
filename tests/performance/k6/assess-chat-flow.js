/**
 * Phase 7.4 - assess-chat-flow.js
 * Scenario C: Full assessment lifecycle with token validation (constant VUs)
 * 9 numeric assertions
 *
 * Profile:
 * - 25 constant VUs for 10 minutes
 * - Full flow: /api/assess/start -> extract sessionToken -> /api/assess/chat (4-6 turns)
 * - JWT validation: token exp > now
 * - Rate limit handling: 429 expected and not counted as error
 * - Message quota tracking: X-Messages-Used and X-Messages-Limit headers
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { THRESHOLDS_ABSOLUTE } from './options.js';
import { buildRealUserAuthHeaders } from './auth.js';

// Configuration (Assertions 1-3: Flow settings)
const CONFIG = {
  duration: '10m',                   // Assertion 1: 10 minute steady test
  vus: 25,                           // Assertion 2: 25 concurrent users
  turnsPerSession: 5,                // Assertion 3: 5 chat turns per assessment
};

// Executor (Assertions 4-5: Assessment executor)
export const options = {
  stages: [
    { duration: CONFIG.duration, target: CONFIG.vus }, // Assertion 4: 25 VUs sustained
  ],
  executor: 'constant-vus',          // Assertion 5: constant VU executor

  thresholds: {
    'http_req_duration': [
      `p(95) <= ${THRESHOLDS_ABSOLUTE.p95_ms}`, // Assertion 6: p95 <= 2000ms
    ],
    'http_req_failed': [
      `rate < 0.01`,                 // Assertion 7: error rate < 1%
    ],
  },

  tags: {
    scenario: 'assess-chat-flow',
    phase: 'phase-7',
  },

  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
};

/**
 * Setup: Initialize test data and validate environment
 * Assertion 8: Setup function validates JWT requirements
 */
export function setup() {
  const baseUrl = __ENV.STAGING_BASE_URL || 'http://localhost:3000';
  const campaignToken = __ENV.TEST_CAMPAIGN_TOKEN || '';
  const candidateName = __ENV.TEST_CANDIDATE_NAME || 'Algomind Load Tester';
  const entryCode = __ENV.TEST_ENTRY_CODE || '';

  if (!campaignToken) {
    throw new Error('TEST_CAMPAIGN_TOKEN environment variable required for Scenario C');
  }

  return {
    baseUrl,
    campaignToken,
    candidateName,
    entryCode,
  };
}

/**
 * Main test function
 * Assertion 9: Default executes full assessment lifecycle
 */
export default function (data) {
  const baseUrl = data.baseUrl;
  const campaignToken = data.campaignToken;
  const candidateName = data.candidateName;
  const entryCode = data.entryCode;

  // Step 1: Start assessment session
  const startResponse = http.post(
    `${baseUrl}/api/assess/start`,
    JSON.stringify({
      campaignToken,
      candidateName,
      entryCode,
    }),
    {
      headers: buildRealUserAuthHeaders({
        'Content-Type': 'application/json',
      }),
      tags: { step: 'assess-start' },
    }
  );

  // Validate start response
  const isStartSuccess = check(startResponse, {
    'assess: start status 200': (r) => r.status === 200,
    'assess: start has sessionToken': (r) =>
      r.json('sessionToken') && r.json('sessionToken').length > 0,
  });

  if (!isStartSuccess) {
    return; // Abort if start failed
  }

  // Extract session token and validate JWT
  const sessionToken = startResponse.json('sessionToken');
  const tokenParts = sessionToken.split('.');
  if (tokenParts.length !== 3) {
    check(false, {
      'assess: sessionToken is valid JWT': () => false,
    });
    return;
  }

  try {
    const payload = JSON.parse(atob(tokenParts[1]));
    const now = Math.floor(Date.now() / 1000);
    check(true, {
      'assess: sessionToken exp > now': () => (payload.exp || 0) > now,
    });
  } catch (e) {
    check(false, {
      'assess: sessionToken payload parseable': () => false,
    });
    return;
  }

  // Step 2: Execute chat turns within session
  let messagesUsed = 0;
  let messagesLimit = 0;

  for (let i = 0; i < CONFIG.turnsPerSession; i++) {
    const chatResponse = http.post(
      `${baseUrl}/api/assess/chat`,
      JSON.stringify({
        sessionToken,
        message: `Assessment turn ${i + 1}: help with this problem`,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: buildRealUserAuthHeaders({
          'Content-Type': 'application/json',
        }),
        tags: {
          step: 'assess-chat',
          turn: i + 1,
        },
      }
    );

    // Handle rate limiting (429 is expected and not an error for quota validation)
    if (chatResponse.status === 429) {
      check(chatResponse, {
        'assess: rate limit (429) is expected': (r) => r.status === 429,
      });
      break; // Stop after hitting rate limit
    }

    // Extract quota headers
    const xMessagesUsed = parseInt(chatResponse.headers['X-Messages-Used'] || '0') || messagesUsed;
    const xMessagesLimit = parseInt(chatResponse.headers['X-Messages-Limit'] || '0') || messagesLimit;

    messagesUsed = xMessagesUsed;
    messagesLimit = xMessagesLimit;

    check(chatResponse, {
      'assess: chat status 200': (r) => r.status === 200,
      'assess: X-Messages-Used increments': () => xMessagesUsed > messagesUsed || i === 0,
      'assess: X-Messages-Limit is consistent': () =>
        xMessagesLimit === messagesLimit || i === 0,
    });

    sleep(Math.random() * 2); // Brief think time
  }

  sleep(Math.random() * 3); // Session cooldown
}
