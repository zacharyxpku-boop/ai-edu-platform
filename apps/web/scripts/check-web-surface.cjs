#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..', '..');
const manifestPath = path.join(root, 'surface-manifest.json');
const contractPath = path.join(repoRoot, 'packages', 'ui-contracts', 'web-surface-contract.cjs');
const {
  WEB_SURFACE_REQUIRED_ENTRIES: requiredEntryIds,
  WEB_SURFACE_LOOP: webSurfaceLoop,
  WEB_SURFACE_VIEW_MODEL_KEYS: webSurfaceViewModelKeys
} = require(contractPath);

function fail(message) {
  console.error(`Web surface check failed: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(manifestPath)) {
  fail('missing apps/web/surface-manifest.json');
}

if (!fs.existsSync(contractPath)) {
  fail('missing packages/ui-contracts/web-surface-contract.cjs');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.surface !== 'web') {
  fail('surface-manifest.json must declare surface="web"');
}

const entries = Array.isArray(manifest.primaryEntries) ? manifest.primaryEntries : [];
const ids = new Set(entries.map((entry) => entry.id));
const missing = requiredEntryIds.filter((id) => !ids.has(id));
if (missing.length) {
  fail(`missing required entries: ${missing.join(', ')}`);
}

const loopIds = new Set(webSurfaceLoop.map((step) => step.id));
const missingLoopIds = requiredEntryIds.filter((id) => id !== 'home' && !loopIds.has(id));
if (missingLoopIds.length) {
  fail(`web surface loop is missing entries: ${missingLoopIds.join(', ')}`);
}

for (const key of ['student', 'progress', 'uploads', 'entries']) {
  if (!webSurfaceViewModelKeys.includes(key)) {
    fail(`web surface view-model contract is missing ${key}`);
  }
}

for (const entry of entries) {
  for (const key of ['id', 'label', 'path', 'miniappParity', 'job', 'webAdaptation']) {
    if (!entry[key]) fail(`entry ${entry.id || '(unknown)'} is missing ${key}`);
  }
  if (!entry.path.startsWith('/')) {
    fail(`entry ${entry.id} path must start with /`);
  }
}

for (const dir of [
  'src',
  'scripts',
  'assets',
  'assets/brand',
  'design-references',
  'design-references/screenshots',
  'design-references/variant',
  'design-references/notes'
]) {
  if (!fs.existsSync(path.join(root, dir))) {
    fail(`missing ${dir}`);
  }
}

for (const file of [
  'index.html',
  'WEB-APP-HANDOFF.md',
  'OFFICIAL-DEPLOY-CHECKLIST.md',
  'design-references/REFERENCE-ASSET-INDEX.md',
  'design-references/notes/gpt-six-screen-reference.md',
  'src/app.js',
  'src/routes.js',
  'src/view-model.js',
  'src/styles.css',
  'scripts/capture-web-preview.cjs',
  '../../packages/ui-contracts/web-surface-contract.cjs',
  'assets/brand/gudian-mascot.png',
  'assets/brand/gudian-mascot-study.png',
  'assets/brand/family-report.png',
  'assets/brand/review-sprout.png'
]) {
  if (!fs.existsSync(path.join(root, file))) {
    fail(`missing ${file}`);
  }
}

const previewShellPath = path.join(repoRoot, 'app', 'index.html');
if (!fs.existsSync(previewShellPath)) {
  fail('missing official-site preview shell: app/index.html');
}

const previewShell = fs.readFileSync(previewShellPath, 'utf8');
for (const requiredSnippet of [
  '/apps/web/src/styles.css',
  '/apps/web/src/app.js',
  'name="web-app-asset-base" content="/apps/web/assets/brand"'
]) {
  if (!previewShell.includes(requiredSnippet)) {
    fail(`app/index.html must include ${requiredSnippet}`);
  }
}

console.log(`Web surface check passed for ${entries.length} entries.`);
