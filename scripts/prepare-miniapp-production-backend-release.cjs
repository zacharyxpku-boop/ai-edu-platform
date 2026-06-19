#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

const releaseFiles = [
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
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : ''
  };
}

function readJson(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter(Boolean);
}

function statusFile(line) {
  const normalized = String(line || '').replace(/\\/g, '/');
  const withoutStatus = normalized.replace(/^[ MADRCU?!]{1,2}\s+/, '');
  return withoutStatus.includes(' -> ')
    ? withoutStatus.split(' -> ').pop()
    : withoutStatus;
}

const scope = run(process.execPath, ['scripts/check-miniapp-production-release-scope.cjs']);
const gitAll = run('git', ['status', '--short', '--untracked-files=all']);
const gitRelease = run('git', ['status', '--short', '--', ...releaseFiles]);
const project = readJson('.vercel/project.json');
const allChanges = lines(gitAll.stdout);
const releaseChanges = lines(gitRelease.stdout);
const releaseFileSet = new Set(releaseFiles);
const unrelatedChanges = allChanges.filter((line) => {
  return !releaseFileSet.has(statusFile(line));
});
const releaseReady = unrelatedChanges.length === 0;

const report = {
  ok: scope.status === 0 && project && project.projectName === 'ai-edu-platform',
  safeToDeployFromCurrentWorktree: releaseReady,
  project: project ? {
    projectName: project.projectName,
    projectId: project.projectId,
    orgId: project.orgId,
    nodeVersion: project.settings && project.settings.nodeVersion
  } : null,
  scopeCheck: {
    status: scope.status,
    stdout: lines(scope.stdout),
    stderr: lines(scope.stderr)
  },
  releaseFiles,
  releaseChangedFiles: releaseChanges,
  unrelatedDirtyCount: unrelatedChanges.length,
  unrelatedDirtyPreview: unrelatedChanges.slice(0, 40),
  deployRisk: unrelatedChanges.length
    ? 'dirty_worktree_contains_unrelated_changes_do_not_full_tree_deploy_without_explicit_release_strategy'
    : 'release_scope_only',
  requiredPreDeployChecks: [
    'node scripts/check-miniapp-backend-release-clean.cjs',
    'node scripts/check-miniapp-production-release-scope.cjs',
    'npm.cmd run miniapp:fullcheck'
  ],
  requiredPostDeployChecks: [
    'npm.cmd run miniapp:fullcheck -- --remote'
  ],
  expectedRemoteFixes: [
    '/api/mini/tutor-message first-step mode returns write_first_step',
    '/api/report-job-status missing case returns 404 report_job_status_missing',
    'legacy public APIs return 410 legacy_endpoint_retired',
    'mini compatibility APIs include compatibility_retained_safe_copy'
  ]
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  process.exit(1);
}
