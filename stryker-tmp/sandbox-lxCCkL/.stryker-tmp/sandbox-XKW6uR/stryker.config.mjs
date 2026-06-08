// @ts-nocheck
// 
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
  coverageAnalysis: 'perTest',
  packageManager: 'npm',

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
    'src/lib/spaced-repetition/fsrs.ts',
    'src/lib/knowledge-graph/service.ts',
    'src/lib/rate-limit/weekly-session-limiter.ts',
    'src/app/api/payment/verify/route.ts',
    'src/app/api/payment/webhook/route.ts',
    'src/lib/assess/jwt.ts',
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
      dir: 'src',
  },
};

export default config;
