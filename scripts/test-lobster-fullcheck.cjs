#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const checks = [
  'scripts/test-lobster-product-core.cjs',
  'scripts/test-lobster-api.cjs',
  'scripts/test-lobster-config-api.cjs',
  'scripts/test-lobster-memory-api.cjs',
  'scripts/test-lobster-capability-api.cjs',
  'scripts/test-lobster-session-api.cjs',
  'scripts/test-lobster-onboarding.cjs',
  'scripts/test-lobster-teacher.cjs',
  'scripts/test-lobster-followup.cjs',
  'scripts/test-lobster-channel-adapter.cjs',
  'scripts/test-lobster-static-shell.cjs',
  'scripts/test-lobster-shell-runtime.cjs',
  'scripts/test-lobster-official-web-entry.cjs',
  'scripts/test-lobster-vercel-bundle.cjs',
  'scripts/test-lobster-sdk.cjs',
  'scripts/test-lobster-manifest.cjs',
  'scripts/test-lobster-product-readiness.cjs'
];

for (const script of checks) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log('Lobster fullcheck passed.');
