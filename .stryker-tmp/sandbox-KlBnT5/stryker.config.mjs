// @ts-nocheck
// 
/**
 * @codesage
 * @file      stryker.config.mjs
 * @purpose   Configuration file for Stryker mutation testing
 * @tech      Stryker, Vitest
 * @connects  Mutates core business logic files like assessment and AI clients
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  // ── Test Runner ────────────────────────────────────────────
  testRunner: 'vitest',

  // ── Mutate Scope ───────────────────────────────────────────
  // Only mutate critical business logic — keeps runs fast and focused.
  mutate: [
    // Existing scope (keep all existing entries)
    'src/lib/assessment/analyzer.ts',
    'src/lib/assessment/score-validator.ts',
    'src/lib/assessment/confidence-calculator.ts',
    'src/lib/ai/client.ts',
    'src/lib/ai/rate-limiter.ts',
    'src/lib/auth/requireAdminForApi.ts',

    // ── Newly added high-risk modules ───────────────────────────
    // FSRS scheduling — wrong algorithm = silent review scheduling bug
    'src/lib/spaced-repetition/fsrs.ts',

    // KG confidence updates — wrong delta = learning graph corruption
    'src/lib/knowledge-graph/service.ts',

    // Weekly session limiter — wrong comparison = limit bypass
    'src/lib/rate-limit/weekly-session-limiter.ts',

    // Payment verification — wrong condition = payment fraud
    'src/app/api/payment/verify/route.ts',

    // Webhook handler — wrong event handling = unauthorized subscription changes
    'src/app/api/payment/webhook/route.ts',

    // JWT handling — wrong validation = session forgery
    'src/lib/assess/jwt.ts',

    // Rate limit decision layer — wrong routing = limit bypass
    'src/lib/rate-limit/decision-layer.ts',
  ],

  // ── Exclude generated and type-only files ─────────────────────────
  ignorePatterns: [
    'src/types/supabase.ts',
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/node_modules/**',
  ],

  // ── Reporters ──────────────────────────────────────────────
  reporters: ['html', 'clear-text', 'progress'],

  // ── Thresholds ─────────────────────────────────────────────
  // high  : Score >= 80% → green in report
  // low   : Score >= 60% → yellow warning
  // break : Score < 50%  → CI fails
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },

  // ── Performance ────────────────────────────────────────────
  concurrency: 4,
  timeoutMS: 10000,
  timeoutFactor: 2,

  // ── Vitest config ─────────────────────────────────────────────────
  vitest: {
      configFile: 'vitest.config.ts',
  },
};

export default config;
