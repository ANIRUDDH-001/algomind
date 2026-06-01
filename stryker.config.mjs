// @ts-check
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
    'src/lib/assessment/analyzer.ts',
    'src/lib/assessment/score-validator.ts',
    'src/lib/assessment/confidence-calculator.ts',
    'src/lib/ai/client.ts',
    'src/lib/ai/rate-limiter.ts',
    'src/lib/auth/requireAdminForApi.ts',
  ],

  // ── Reporters ──────────────────────────────────────────────
  reporters: ['clear-text', 'json'],

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
  timeoutMS: 30000,
};

export default config;
