#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'lobster', 'lobster-product-manifest.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

assert.strictEqual(manifest.schema_id, 'lobster_product_manifest_v1', 'manifest has stable schema id');
assert.strictEqual(manifest.surfaces.sdk, 'src/lobster/lobster-sdk.cjs', 'manifest exposes SDK surface');
assert.strictEqual(manifest.surfaces.core, 'src/lobster/lobster-core.cjs', 'manifest exposes core surface');
['message', 'config', 'memory', 'capability', 'session', 'onboarding', 'teacher', 'followup', 'followup_due', 'followup_inbox', 'channel_webhook'].forEach((id) => {
  assert(manifest.surfaces.apis.some((api) => api.id === id), `manifest includes ${id} API`);
});
assert(manifest.roles.child.default_tools.includes('socratic_teacher_reply'), 'manifest includes child teacher tool');
assert(manifest.roles.child.default_tools.includes('mini_lesson_bridge'), 'manifest includes child mini lesson tool');
assert(manifest.roles.parent.default_tools.includes('parent_decision_report'), 'manifest includes parent report tool');
assert(manifest.roles.parent.default_tools.includes('weekly_trend_brief'), 'manifest includes parent weekly trend tool');
assert(manifest.verification.tests.includes('node scripts/test-lobster-sdk.cjs'), 'manifest includes SDK test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-followup.cjs'), 'manifest includes follow-up test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-channel-adapter.cjs'), 'manifest includes channel adapter test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-static-shell.cjs'), 'manifest includes static shell test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-shell-runtime.cjs'), 'manifest includes shell runtime test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-official-web-entry.cjs'), 'manifest includes official web entry test');
assert(manifest.verification.tests.includes('node scripts/test-lobster-vercel-bundle.cjs'), 'manifest includes Vercel bundle test');
assert.strictEqual(manifest.verification.fullcheck, 'node scripts/test-lobster-fullcheck.cjs', 'manifest records fullcheck command');
assert.strictEqual(packageJson.scripts['lobster:fullcheck'], 'node scripts/test-lobster-fullcheck.cjs', 'package exposes lobster fullcheck script');
assert(fs.existsSync(path.join(root, 'docs', 'LOBSTER_USAGE.md')), 'usage doc exists');
assert(fs.existsSync(path.join(root, 'docs', 'LOBSTER_DEPLOYMENT.md')), 'deployment doc exists');

console.log('Lobster manifest tests pass.');
