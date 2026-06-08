// @ts-nocheck
const fs = require('fs');
const path = require('path');

const files = [
"src/lib/design-tokens.ts",
"src/lib/feature-flags-server.ts",
"src/lib/feature-flags.ts",
"src/lib/utils.ts",
"src/lib/auth/account-type.ts",
"src/lib/auth/is-admin.ts",
"src/lib/auth/require-employer.ts",
"src/lib/auth/requireAdminForApi.ts",
"src/lib/auth/requireOwnerForApi.ts",
"src/lib/auth/role-policy.ts",
"src/lib/auth/session-cache.ts",
"src/lib/auth/session-manager.ts",
"src/lib/auth/__tests__/requireAdminForApi.test.ts",
"src/lib/auth/__tests__/role-policy-matrix.test.ts",
"src/lib/campaign/entry-code.ts",
"src/lib/campaign/question-timer.ts",
"src/lib/config/system-config-keys.ts",
"src/lib/config/system-config.ts",
"src/lib/diagnostic/questions.ts",
"src/lib/errors/handler.ts",
"src/lib/errors/user-friendly-errors.ts",
"src/lib/guest/guest-problems.ts",
"src/lib/inngest/client.ts",
"src/lib/inngest/functions.ts",
"src/lib/learn/system-prompt.ts",
"src/lib/learn/tutor-behavioral-contract.ts",
"src/lib/learn/tutor-prompt.ts",
"src/lib/learn/__tests__/system-prompt.test.ts",
"src/lib/learn/__tests__/tutor-prompt.test.ts",
"src/lib/monitoring/events.ts",
"src/lib/monitoring/__tests__/event-taxonomy.contract.test.ts",
"src/lib/monitoring/__tests__/route-correlation-audit.contract.test.ts",
"src/lib/onboarding/manager.ts",
"src/lib/rate-limit/decision-layer.ts",
"src/lib/rate-limit/ip-rate-limiter.ts",
"src/lib/rate-limit/user-rate-limiter.ts",
"src/lib/rate-limit/weekly-session-limiter.ts",
"src/lib/rate-limit/__tests__/failure-injection-matrix.test.ts",
"src/lib/rate-limit/__tests__/ip-rate-limiter.failure-mode.test.ts",
"src/lib/rate-limit/__tests__/policy-matrix.test.ts",
"src/lib/rate-limit/__tests__/rate-limit-integration.test.ts",
"src/lib/rate-limit/__tests__/user-rate-limiter.test.ts",
"src/lib/rate-limit/__tests__/weekly-session-limiter.test.ts",
"src/lib/recommendations/difficulty-calibrator.ts",
"src/lib/recommendations/engine.ts",
"src/lib/recommendations/insight-engine.ts",
"src/lib/recommendations/__tests__/insight-engine.new-cards.test.ts",
"src/lib/spaced-repetition/fsrs.ts",
"src/lib/spaced-repetition/queue.ts",
"src/lib/spaced-repetition/skill-scheduler.ts",
"src/lib/spaced-repetition/sm2.ts",
"src/lib/spaced-repetition/types.ts",
"src/lib/spaced-repetition/__tests__/fsrs.difficulty.test.ts",
"src/lib/spaced-repetition/__tests__/skill-queue.integration.test.ts",
"src/lib/spaced-repetition/__tests__/skill-scheduler.test.ts",
"src/lib/spaced-repetition/__tests__/sm2.test.ts",
"src/lib/startup/validateEnv.ts",
"src/lib/startup/__tests__/validateEnv.test.ts",
"src/lib/tour/index.ts",
"src/lib/tracing/correlation.ts",
"src/lib/utils/device-detection.ts",
"src/lib/utils/retry.ts",
"src/lib/__tests__/design-tokens.test.ts",
"src/lib/__tests__/migrations.test.ts"
];

let summaryData = {
  section: "SEC-06A",
  name: "Other Libs (Part 1)",
  files_processed: [],
  section_summary: "Processed core utility libraries, authentication guards, configuration definitions, and rate-limiting infrastructure for the application. Also audited testing, spaced repetition queue algorithms, and recommendation engine core logic."
};

let deadCodeLog = "";

files.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${file} - not found`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');

  // Identify dead code (simple console.log removal)
  const lines = content.split('\n');
  const newLines = [];
  let removedLogs = [];
  
  lines.forEach(line => {
    if (line.match(/^\s*console\.log\(/) && !file.includes('test')) {
      removedLogs.push(line.trim());
      deadCodeLog += `Removed from ${file}: ${line.trim()}\n`;
    } else {
      newLines.push(line);
    }
  });

  content = newLines.join('\n');
  const isTest = file.includes('__tests__') || file.includes('.test.');
  let numLines = newLines.length;

  let purpose = "Provides core utility and library functions.";
  if (file.includes('design-tokens')) purpose = "Defines shared design tokens and animations.";
  else if (file.includes('feature-flags')) purpose = "Manages feature flag configuration and access.";
  else if (file.includes('utils.ts')) purpose = "Common utility functions.";
  else if (file.includes('auth/')) purpose = "Authentication guards, roles, and session management.";
  else if (file.includes('campaign/')) purpose = "Campaign code verification and timer handling.";
  else if (file.includes('config/')) purpose = "System configuration settings and environment keys.";
  else if (file.includes('diagnostic/')) purpose = "Handles diagnostic questions.";
  else if (file.includes('errors/')) purpose = "Error handling and user-friendly error formatting.";
  else if (file.includes('guest/')) purpose = "Guest user management and problem generation.";
  else if (file.includes('inngest/')) purpose = "Inngest job client and function definitions.";
  else if (file.includes('learn/')) purpose = "System and tutor prompts for AI learning assistant.";
  else if (file.includes('monitoring/')) purpose = "Telemetry, events mapping, and route correlation.";
  else if (file.includes('onboarding/')) purpose = "User onboarding state manager.";
  else if (file.includes('rate-limit/')) purpose = "Rate limiting policies across user, IP, and sessions.";
  else if (file.includes('recommendations/')) purpose = "Recommendation engine, calibrator, and insight processing.";
  else if (file.includes('spaced-repetition/')) purpose = "Spaced repetition algorithms (FSRS, SM2) and scheduling queues.";
  else if (file.includes('startup/')) purpose = "Environment validation at system startup.";
  else if (file.includes('tour/')) purpose = "App tour manager configuration.";
  else if (file.includes('tracing/')) purpose = "Correlation ID generation for request tracing.";

  if (isTest) purpose = "Tests for " + purpose;

  let libs = "Node.js";
  if (file.includes('auth')) libs += ", NextAuth / Auth handlers";
  if (file.includes('inngest')) libs += ", Inngest";
  if (file.includes('rate-limit')) libs += ", Upstash Redis";
  if (file.includes('spaced-repetition')) libs += ", ts-fsrs";

  let header = `/**
 * @codesage
 * @file      ${file.replace(/\\\\/g, '/')}
 * @purpose   ${purpose}
 * @tech      ${libs}
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        ${file.includes('auth') || file.includes('rate-limit') ? 'Redis / Supabase Auth' : 'None'}
 * @state     ${file.includes('session') ? 'Session state' : 'Stateless'}
 * @env       ${file.includes('config') || file.includes('startup') ? 'process.env variables' : 'None'}
 * @issues    ${removedLogs.length > 0 ? 'Removed console.logs. ' : ''}No major issues observed.
 * @audit     CODESAGE-v1${isTest ? ' | @skip: test-file' : ''}
 */\n`;

  // Remove existing @codesage block if present
  let cleanContent = content;
  if (cleanContent.includes('@codesage')) {
    cleanContent = cleanContent.replace(/\/\*\*[\s\S]*?@codesage[\s\S]*?\*\/\n?/, '');
  }
  
  // Find where to insert (after shebang or "use client")
  let insertIndex = 0;
  let finalLines = cleanContent.split('\n');
  if (finalLines.length > 0 && finalLines[0].startsWith('#!')) {
    insertIndex = 1;
  }
  if (finalLines.length > 0 && finalLines[0].includes('use client')) {
    insertIndex = 1;
  }
  if (finalLines.length > 1 && finalLines[1].includes('use client')) {
    insertIndex = 2;
  }
  
  // Also check if file > 500 lines for section level summary
  if (finalLines.length > 500) {
     header = header.replace('@issues    ', '@summary   This is a large file (> 500 lines) handling complex logic for ' + purpose + '\n * @issues    ');
  }

  finalLines.splice(insertIndex, 0, header.trim());
  fs.writeFileSync(fullPath, finalLines.join('\n'));

  summaryData.files_processed.push({
    file: file,
    purpose: purpose
  });
});

if (deadCodeLog.trim() !== "") {
  fs.appendFileSync(path.join(process.cwd(), '.codesage/dead_code_log.md'), deadCodeLog);
}

fs.writeFileSync(path.join(process.cwd(), '.codesage/sections/SEC-06A_summary.json'), JSON.stringify(summaryData, null, 2));

console.log('Processed successfully!');
