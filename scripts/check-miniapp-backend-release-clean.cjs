#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const allowedReleaseFiles = new Set([
  '.vercelignore',
  'vercel.json',
  'lib/env.js',
  'lib/mini-store.js',
  'lib/mini-shared.js',
  'lib/mini-handlers/session.js',
  'lib/mini-handlers/me.js',
  'lib/mini-handlers/profile-children.js',
  'lib/mini-handlers/role-switch.js',
  'lib/mini-handlers/content-check.js',
  'lib/mini-handlers/priority.js',
  'lib/mini-handlers/weekly.js',
  'lib/mini-handlers/material-image.js',
  'lib/mini-handlers/quiz-generate.js',
  'lib/mini-handlers/review-today.js',
  'lib/mini-handlers/content-engine.js',
  'lib/mini-handlers/sync.js',
  'lib/mini-handlers/event.js',
  'lib/mini-handlers/student-timeline.js',
  'lib/mini-handlers/student-portrait.js',
  'lib/mini-handlers/knowledge-map.js',
  'lib/mini-handlers/subscription-reminder.js',
  'lib/mini-handlers/billing.js',
  'lib/mini-handlers/pay-wechat-notify.js',
  'lib/mini-handlers/legal.js',
  'lib/mini-handlers/admin.js',
  'lib/mini-handlers/review-grade.js',
  'lib/mini-handlers/quiz-submit.js',
  'lib/mini-handlers/report.js',
  'lib/mini-handlers/learning-report-recognize.js',
  'lib/mini-handlers/lead.js',
  'api/mini-dispatch.js',
  'api/mini/tutor-message.js',
  'api/mini/material-image.js',
  'api/mini/qbank-topic.js',
  'api/miniapp-material-analysis.js',
  'api/retired.js',
  'api/report-job-status.js',
  'api/get-questions.js',
  'api/fsrs-due.js',
  'api/ingest-attempt.js',
  'api/log-dialogue.js',
  'api/tutor-chat.js',
  'api/achievement-quote.js',
  'api/leaderboard.js',
  'api/achievements.js',
  'api/shop/items.js',
  'api/shop/purchase.js',
  'api/mini/_game.js',
  'api/mini/event.js',
  'api/mini/feedback.js',
  'api/mini/shop.js',
  'api/mini/leaderboard.js',
  'api/mini/achievements.js',
  'scripts/check-miniapp-production-release-scope.cjs',
  'scripts/prepare-miniapp-production-backend-release.cjs',
  'scripts/build-miniapp-backend-release-patch.cjs',
  'scripts/check-miniapp-backend-release-clean.cjs',
  'scripts/test-miniapp-phase1-backend-contract.cjs',
  'scripts/test-miniapp-phase2-backend-contract.cjs',
  'scripts/test-live-miniapp-api-smoke.cjs',
  'scripts/test-rls-api-contract.cjs',
  'scripts/test-miniapp-production.cjs',
  'scripts/test-commercial-shell.cjs',
  'scripts/test-miniapp-reference-library-inventory.cjs',
  'scripts/test-miniapp-reference-html-coverage.cjs',
  'scripts/test-miniapp-reference-visual-shell.cjs',
  'scripts/test-miniapp-first-screen-density-contract.cjs',
  'scripts/test-miniapp-tab-product-focus.cjs',
  'scripts/test-miniapp-entry-detail-route-contract.cjs',
  'scripts/scan-bg-wipe.cjs',
  'scripts/test-five-user-journey-smoke.cjs',
  'scripts/test-miniapp-user-journey-risk-smoke.cjs',
  'scripts/test-miniapp-deep-link-runtime.cjs',
  'scripts/test-revisit-engine.cjs',
  'scripts/test-qbank-integration.cjs',
  'scripts/test-legacy-api-inventory-risk.cjs',
  'scripts/test-miniapp-real-device-capture-contract.cjs',
  'scripts/test-miniapp-devtools-simulator-capture-contract.cjs',
  'scripts/test-miniapp-runtime-window-capture-contract.cjs',
  'scripts/test-miniapp-runtime-walkthrough-capture-contract.cjs',
  'scripts/test-miniapp-manual-screenshot-audit-contract.cjs',
  'scripts/test-live-miniapp-user-journey.cjs',
  'scripts/miniapp-fullcheck.cjs',
  'supabase/migrations/20260613_enable_rls.sql',
  'supabase/migrations/20260614_harden_rls_after_poc.sql',
  'supabase/migrations/20260614_mini_learning_persistence.sql',
  'supabase/migrations/20260619_mini_phase1_backend_contract.sql',
  'supabase/migrations/20260619_mini_phase2_backend_modules.sql',
  'docs/MINIAPP-REFERENCE-ADOPTION.md'
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: false
  });
  if (result.error) throw result.error;
  return result;
}

function parseStatusPath(line) {
  const normalized = String(line || '').replace(/\\/g, '/').replace(/\s+$/, '');
  const file = normalized.replace(/^[ MADRCU?!]{1,2}\s+/, '');
  return file.includes(' -> ') ? file.split(' -> ').pop() : file;
}

const status = run('git', ['status', '--short', '--untracked-files=all']);
if (status.status !== 0) {
  process.stderr.write(status.stderr || status.stdout || 'git status failed\n');
  process.exit(status.status || 1);
}

const changed = (status.stdout || '')
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => ({ line, file: parseStatusPath(line) }));

const unrelated = changed.filter((item) => !allowedReleaseFiles.has(item.file));
const releaseChanges = changed.filter((item) => allowedReleaseFiles.has(item.file));

if (unrelated.length) {
  console.error('Miniapp backend release clean gate failed.');
  console.error(`releaseChangedFiles=${releaseChanges.length}`);
  console.error(`unrelatedDirtyFiles=${unrelated.length}`);
  for (const item of unrelated.slice(0, 80)) console.error(`UNRELATED ${item.line}`);
  console.error('Do not deploy production from this worktree. Use a clean release branch or a controlled cherry-pick of the listed backend API files.');
  process.exit(1);
}

console.log('Miniapp backend release clean gate passed.');
console.log(`releaseChangedFiles=${releaseChanges.length}`);
