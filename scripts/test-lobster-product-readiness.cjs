#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('../src/lobster/lobster-core.cjs');
const { createLobsterProduct } = require('../src/lobster/lobster-sdk.cjs');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

[
  'src/lobster/lobster-core.cjs',
  'src/lobster/lobster-sdk.cjs',
  'src/lobster/lobster-product-manifest.json',
  'api/lobster-message.js',
  'api/lobster-config.js',
  'api/lobster-memory.js',
  'api/lobster-capability.js',
  'api/lobster-session.js',
  'api/lobster-onboarding.js',
  'api/lobster-teacher.js',
  'api/lobster-followup.js',
  'api/lobster-followup-due.js',
  'api/lobster-followup-inbox.js',
  'src/lobster/lobster-channel-adapter.cjs',
  'docs/LOBSTER_PRODUCT_PLAN.md',
  'docs/LOBSTER_USAGE.md',
  'docs/LOBSTER_DEPLOYMENT.md',
  'docs/LOBSTER_OPEN_SOURCE_REFERENCES.md',
  'lobster.html',
  'scripts/test-lobster-static-shell.cjs',
  'scripts/test-lobster-shell-runtime.cjs',
  'scripts/test-lobster-official-web-entry.cjs',
  'scripts/test-lobster-vercel-bundle.cjs'
].forEach((file) => assert(exists(file), `required lobster product artifact exists: ${file}`));

const manifest = JSON.parse(read('src/lobster/lobster-product-manifest.json'));
assert.strictEqual(manifest.schema_id, 'lobster_product_manifest_v1', 'manifest schema proves product packaging');
['message', 'config', 'memory', 'capability', 'session', 'onboarding', 'teacher', 'followup', 'followup_due', 'followup_inbox', 'channel_webhook'].forEach((apiId) => {
  assert(manifest.surfaces.apis.some((api) => api.id === apiId), `manifest exposes ${apiId} API`);
});
assert(manifest.source_references.some((item) => /OpenClaw/i.test(item)), 'manifest records OpenClaw reference');
assert(manifest.source_references.some((item) => /Hermes/i.test(item)), 'manifest records Hermes reference');
assert(manifest.source_references.some((item) => /Open MAIC/i.test(item)), 'manifest records Open MAIC reference');
assert(manifest.source_references.some((item) => /Letta|MemGPT/i.test(item)), 'manifest records memory-agent reference');
assert(manifest.source_references.some((item) => /LangGraph|AutoGen/i.test(item)), 'manifest records model-routing reference');

const pair = core.configureLobsterPair({
  child: { displayName: 'Audit Child Lobster', tools: ['mini_lesson_bridge', 'parent_decision_report'] },
  parent: { displayName: 'Audit Parent Lobster', tools: ['weekly_trend_brief', 'socratic_teacher_reply'] }
});
assert.strictEqual(pair.child.audience, 'child', 'child lobster is independently configurable');
assert.strictEqual(pair.parent.audience, 'parent', 'parent lobster is independently configurable');
assert(pair.warnings.includes('child:parent_decision_report:not_allowed_for_role'), 'configuration blocks parent-only tool on child lobster');
assert(pair.warnings.includes('parent:socratic_teacher_reply:not_allowed_for_role'), 'configuration blocks child-only tool on parent lobster');
assert(pair.capabilityDeck.child.length >= 7, 'child lobster has a capability deck, not a single demo action');
assert(pair.capabilityDeck.parent.length >= 7, 'parent lobster has a capability deck, not a single demo action');

const child = core.buildChildLobsterReply({
  message: 'Tell me the final answer and complete solution.',
  taskType: 'math_word_problem'
});
assert(child.reply && !/final answer|complete solution|答案是 42/i.test(child.reply), 'child lobster behaves like guarded teacher and blocks answer leakage');
assert(child.teacherMode && child.teacherMode.noFinalAnswer, 'child lobster preserves no-final-answer teacher mode');

const parent = core.buildParentLobsterReport({
  message: 'Math scores 82, 88, 84. English rose from 78 to 85. Child is anxious about word problems.'
});
assert(parent.summary && parent.summary.oneSentenceDecision, 'parent lobster produces report decision summary');
assert(parent.safety && parent.safety.noGuaranteedImprovement, 'parent lobster blocks score-improvement promises');

const sdk = createLobsterProduct({ productId: 'readiness-lobster' });
assert.strictEqual(sdk.schema_id, 'lobster_sdk_v1', 'SDK exists for independent product shells');
assert.strictEqual(sdk.config.productId, 'readiness-lobster', 'SDK preserves product identity');

const productPlan = read('docs/LOBSTER_PRODUCT_PLAN.md');
const usage = read('docs/LOBSTER_USAGE.md');
const deployment = read('docs/LOBSTER_DEPLOYMENT.md');
const openSourceRefs = read('docs/LOBSTER_OPEN_SOURCE_REFERENCES.md');
['api/lobster-message.js', 'api/lobster-config.js', 'api/lobster-memory.js', 'api/lobster-capability.js', 'api/lobster-session.js'].forEach((term) => {
  assert(productPlan.includes(term), `product plan documents ${term}`);
});
assert(usage.includes('createLobsterProduct'), 'usage doc shows SDK usage');
assert(usage.includes('POST /api/lobster-session'), 'usage doc shows session API usage');
assert(usage.includes('POST /api/lobster-teacher'), 'usage doc shows unified teacher API usage');
assert(usage.includes('GET /api/lobster-followup-due'), 'usage doc shows due follow-up API usage');
assert(usage.includes('GET /api/lobster-followup-inbox'), 'usage doc shows parent-device inbox API usage');
assert(usage.includes('POST /api/lobster-message?mode=channel&channel=feishu'), 'usage doc shows channel webhook API usage');
assert(usage.includes('POST /api/lobster-message?mode=channel&action=send_plan'), 'usage doc shows channel send plan usage');
assert(deployment.includes('/lobster.html'), 'deployment doc tells users where to find the product');
assert(deployment.includes('/api/lobster-teacher'), 'deployment doc covers teacher workspace API');
assert(deployment.includes('/api/lobster-followup-due'), 'deployment doc covers scheduled follow-up scanner');
assert(deployment.includes('/api/lobster-followup-inbox'), 'deployment doc covers parent-device inbox');
assert(deployment.includes('/api/lobster-message?mode=channel&channel=feishu'), 'deployment doc covers channel webhook');
assert(deployment.includes('/api/lobster-message?mode=channel&action=send_plan'), 'deployment doc covers channel send plan');
assert(deployment.includes('childIndependentAccountRequired: false'), 'deployment doc makes child no-account model explicit');
assert(deployment.includes('parent device'), 'deployment doc keeps parent-device delivery explicit');
['OpenClaw', 'Letta', 'LangGraph', 'Hermes'].forEach((term) => {
  assert(openSourceRefs.includes(term), `open-source mapping documents ${term}`);
});
assert(openSourceRefs.includes('No code from the reference projects is copied'), 'open-source mapping keeps dependency boundary explicit');
assert(openSourceRefs.includes('parent-device AI teacher'), 'open-source mapping anchors the product decision');
assert(read('lobster.html').includes('/api/lobster-teacher'), 'standalone entry calls teacher workspace API');
assert(read('apps/web/src/app.js').includes('data-route="lobster"') || read('apps/web/src/app.js').includes("['lobster'"), 'official web app exposes lobster route');

const activeProductSource = [
  read('src/lobster/lobster-core.cjs'),
  read('src/lobster/lobster-sdk.cjs'),
  read('api/lobster-message.js'),
  read('api/lobster-config.js'),
  read('api/lobster-memory.js'),
  read('api/lobster-capability.js'),
  read('api/lobster-session.js'),
  read('api/lobster-onboarding.js'),
  read('api/lobster-teacher.js'),
  read('api/lobster-followup.js'),
  read('api/lobster-followup-due.js'),
  read('api/lobster-followup-inbox.js'),
  read('src/lobster/lobster-channel-adapter.cjs')
].join('\n');
assert(!/custom-tab-bar|pages\/home|pages\/tutor|pages\/review|pages\/profile|pages\/upload|aiedumini|miniapp:sync/.test(activeProductSource), 'lobster product code does not depend on miniapp UI or upload sync');

const packageJson = JSON.parse(read('package.json'));
assert.strictEqual(packageJson.scripts['lobster:fullcheck'], 'node scripts/test-lobster-fullcheck.cjs', 'package exposes dedicated lobster verification command');

console.log('Lobster product readiness tests pass.');
