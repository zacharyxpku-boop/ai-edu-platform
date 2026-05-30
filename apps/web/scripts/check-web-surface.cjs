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
  if (entry.id !== 'home' && !entry.childScenePattern) {
    fail(`entry ${entry.id} must document its compact child-scene pattern`);
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

const vercelPath = path.join(repoRoot, 'vercel.json');
if (!fs.existsSync(vercelPath)) {
  fail('missing vercel.json');
}

const previewShell = fs.readFileSync(previewShellPath, 'utf8');
const appHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const appCss = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const routesJs = fs.readFileSync(path.join(root, 'src', 'routes.js'), 'utf8');
const viewModelJs = fs.readFileSync(path.join(root, 'src', 'view-model.js'), 'utf8');
const manifestText = fs.readFileSync(manifestPath, 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

const forbiddenMiniappParityRoutes = [
  ['pages', 'daily-math', 'daily-math'].join('/'),
  ['pages', 'dictation', 'dictation'].join('/'),
  ['pages', 'light-diagnosis', 'light-diagnosis'].join('/'),
  ['pages', 'focus', 'focus'].join('/'),
  ['pages', 'tools', 'tools'].join('/'),
  ['pages', 'module', 'module'].join('/'),
  ['pages', 'radar', 'radar'].join('/'),
  ['pages', 'diagnosis', 'diagnosis'].join('/')
];

for (const retiredRoute of forbiddenMiniappParityRoutes) {
  if (routesJs.includes(retiredRoute) || manifestText.includes(retiredRoute)) {
    fail(`web route contracts must not point at retired miniapp UI: ${retiredRoute}`);
  }
}

const retiredOfficialSitePaths = [
  'tutor',
  'mastery-loop',
  'parent-radar',
  'parent-report',
  'mentor',
  'welcome',
  'admin',
  'tools',
  'assistant',
  'paths',
  'question-bank',
  'quiz',
  'app-lite',
  'diagnose',
  'learning-pack',
  'membership',
  'study-tools',
  'tools-guide',
  'warm-focus-v1',
  'weekly',
  'progress',
  'platform',
  'methods',
  'methodology',
  'demo'
];

const legacyRedirects = Array.isArray(vercelConfig.redirects)
  ? vercelConfig.redirects.filter((item) => item && item.destination === '/app')
  : [];
const legacySources = legacyRedirects.map((item) => item.source || '').join('\n');

for (const legacyPath of retiredOfficialSitePaths) {
  if (!legacySources.includes(legacyPath)) {
    fail(`vercel redirects must retire old official-site UI path: /${legacyPath}`);
  }
}

for (const redirect of Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : []) {
  if (
    ['/assistant', '/mastery-loop', '/parent-radar', '/parent-report'].includes(redirect.destination)
  ) {
    fail(`vercel redirect still points to retired official-site UI: ${redirect.source} -> ${redirect.destination}`);
  }
}

for (const requiredRoute of [
  'pages/entry-detail/entry-detail?scene=report',
  'pages/entry-detail/entry-detail?scene=parent',
  'pages/entry-detail/entry-detail?scene=today'
]) {
  if (!routesJs.includes(requiredRoute) || !manifestText.includes(requiredRoute)) {
    fail(`web route contracts must preserve active entry-detail parity: ${requiredRoute}`);
  }
}

const requiredReferenceAssets = [
  'brand-house.png',
  'entry-upload.png',
  'entry-report.png',
  'entry-tutor.png',
  'entry-review.png',
  'entry-parent.png',
  'entry-map.png',
  'gudian-sticker.png',
  'hero-mascot.png'
];

for (const assetName of requiredReferenceAssets) {
  const miniappAssetPath = path.join(repoRoot, 'miniprogram', 'assets', 'reference', assetName);
  const webAssetPath = path.join(root, 'assets', 'reference', assetName);
  if (!fs.existsSync(miniappAssetPath)) fail(`miniapp reference asset is missing: ${assetName}`);
  if (!fs.existsSync(webAssetPath)) fail(`web reference asset is missing: ${assetName}`);
  const miniappAssetSize = fs.statSync(miniappAssetPath).size;
  const webAssetSize = fs.statSync(webAssetPath).size;
  if (miniappAssetSize !== webAssetSize) {
    fail(`web/miniapp reference asset mismatch: ${assetName}`);
  }
}

for (const requiredSnippet of [
  '/apps/web/src/styles.css',
  '/apps/web/src/app.js',
  'name="web-app-asset-base" content="/apps/web/assets/brand"'
]) {
  if (!previewShell.includes(requiredSnippet)) {
    fail(`app/index.html must include ${requiredSnippet}`);
  }
}

for (const requiredSnippet of [
  'class="brand-mark" src="./assets/reference/brand-house.png"',
  'class="family-face" src="./assets/reference/entry-parent.png"',
  '<button class="bell" type="button" data-action="notifications" aria-label="通知"><span></span><em>3</em></button>'
]) {
  if (!appHtml.includes(requiredSnippet)) {
    fail(`apps/web/index.html must use reference-asset shell markup: ${requiredSnippet}`);
  }
}

for (const requiredAsset of [
  'brand-house.png',
  'entry-upload.png',
  'entry-report.png',
  'entry-tutor.png',
  'entry-review.png',
  'entry-parent.png',
  'entry-map.png'
]) {
  if (!appJs.includes(`'${requiredAsset}'`)) {
    fail(`apps/web/src/app.js must route navigation through ${requiredAsset}`);
  }
}

for (const [route, visualMarker] of [
  ['upload', '<section class="upload-console"'],
  ['report', '<section class="report-hero pro card"'],
  ['tutor', '<section class="tutor-lab"'],
  ['review', '<section class="review-world card"'],
  ['parent', '<section class="parent-dashboard"'],
  ['map', '<section class="learning-road card"']
]) {
  const visualIndex = appJs.indexOf(visualMarker);
  const guideIndex = appJs.indexOf(`pageGuide('${route}')`);
  if (visualIndex < 0 || guideIndex < 0) {
    fail(`web ${route} page must include both visual marker and guide marker`);
  }
  if (guideIndex < visualIndex) {
    fail(`web ${route} page must show the visual product surface before the process guide`);
  }
}

if (!appJs.includes('function sceneSwitch(activeId)') || !appCss.includes('.web-scene-switch')) {
  fail('web subpages must implement the compact six-entry scene switch');
}

for (const route of ['upload', 'report', 'tutor', 'review', 'parent', 'map']) {
  if (!appJs.includes(`sceneSwitch('${route}')`)) {
    fail(`web ${route} page must render the compact scene switch`);
  }
}

for (const requiredSnippet of [
  'grid-template-columns: repeat(6, minmax(0, 1fr))',
  '.web-scene-switch button.active',
  'grid-template-columns: repeat(3, minmax(0, 1fr))'
]) {
  if (!appCss.includes(requiredSnippet)) {
    fail(`web scene switch CSS is missing ${requiredSnippet}`);
  }
}

for (const forbiddenSnippet of [
  "['home', '学习主界面', '⌂']",
  "['upload', '上传资料', '⇧']",
  ["['tutor', 'AI", "私教', '☻']"].join(''),
  "['parent', '家长中心', '♙']",
  '\u9358\u7192\u7ca3\u5073',
  '\u701b\uff04\u7bc4',
  '\u6d93\u5a09\u7d36',
  '\u7ec9\u4f7d\u6680',
  '\u702c\u582e\u66b1',
  "'purple'",
  '.level-card.purple'
]) {
  if (appJs.includes(forbiddenSnippet) || appCss.includes(forbiddenSnippet) || viewModelJs.includes(forbiddenSnippet)) {
    fail(`web UI must not regress to retired symbolic color design: ${forbiddenSnippet}`);
  }
}

if (appJs.includes('⇧ 选择文件')) {
  fail('web upload CTA must not use symbolic arrow text from the old design');
}

for (const retiredVisualCss of [
  '.art-folder',
  '.art-report',
  '.art-bot',
  '.art-gamepad',
  '.art-family',
  '.art-map',
  '.entry-visual::before',
  '.entry-visual::after',
  '.mascot {'
]) {
  if (appHtml.includes(retiredVisualCss) || appJs.includes(retiredVisualCss) || appCss.includes(retiredVisualCss)) {
    fail(`web UI must not keep retired CSS-drawn visual system: ${retiredVisualCss}`);
  }
}

for (const requiredCss of [
  '.brand-mark',
  '.nav-list a img',
  '.mobile-tabs a img',
  'url("../assets/reference/brand-house.png")'
]) {
  if (!appCss.includes(requiredCss)) {
    fail(`apps/web/src/styles.css must style reference image assets: ${requiredCss}`);
  }
}

console.log(`Web surface check passed for ${entries.length} entries.`);
