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
  WEB_MINIAPP_CHILD_SCENES: requiredMiniappChildScenes,
  WEB_SURFACE_LOOP: webSurfaceLoop,
  WEB_SURFACE_VIEW_MODEL_KEYS: webSurfaceViewModelKeys
} = require(contractPath);

function fail(message) {
  console.error(`Web surface check failed: ${message}`);
  process.exit(1);
}

function cssRuleContains(css, selector, required, message) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = new RegExp(`${escaped}\\s*\\{[\\s\\S]*?\\}`, 'g');
  const matches = css.match(rule) || [];
  if (!matches.length) fail(`${message}: missing ${selector}`);
  if (!matches.some((match) => required.every((part) => match.includes(part)))) {
    fail(`${message}: ${selector} must include ${required.join(', ')}`);
  }
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

const retiredRootHtmlPages = [
  'tutor.html',
  'mastery-loop.html',
  'parent-radar.html',
  'parent-report.html',
  'mentor.html',
  'welcome.html',
  'admin.html',
  'assistant.html',
  'paths.html',
  'question-bank.html',
  'quiz.html',
  'app-lite.html',
  'diagnose.html',
  'learning-pack.html',
  'membership.html',
  'study-tools.html',
  'tools-guide.html',
  'warm-focus-v1.html',
  'weekly.html',
  'progress.html',
  'platform.html',
  'methods.html',
  'methodology.html',
  'demo.html'
];

for (const page of retiredRootHtmlPages) {
  const pagePath = path.join(repoRoot, page);
  if (!fs.existsSync(pagePath)) {
    fail(`retired root HTML page is missing instead of being redirected: ${page}`);
  }
  const pageText = fs.readFileSync(pagePath, 'utf8');
  if (!pageText.includes("location.replace('/app' + location.search + location.hash)") || !pageText.includes('这个历史入口已下线')) {
    fail(`${page} must be a clean redirect shell to /app, not an old UI page`);
  }
  if (/[�]|瀛|涓|鍘|澶|绉|璧|鎶|鐭|瀹|浠|娓|闂|闈|鈥|鈱|鈻/.test(pageText)) {
    fail(`${page} redirect shell must not contain mojibake or corrupted Chinese text`);
  }
}

const webVisibleSurfaceText = [
  ['apps/web/src/app.js', appJs],
  ['apps/web/src/routes.js', routesJs],
  ['apps/web/src/view-model.js', viewModelJs],
  ['apps/web/surface-manifest.json', manifestText],
  ['apps/web/index.html', appHtml]
];

const retiredVisibleTerms = [
  '复习' + '岛',
  '小' + '游戏',
  '闯' + '关',
  '关' + '卡',
  '轻' + '练',
  '轻复' + '练',
  'knowledge-' + 'ar' + 'cade',
  '变式' + '挑战',
  '查看' + '勋章'
];

for (const [file, text] of webVisibleSurfaceText) {
  if (/[�]|瀛|涓|鍘|澶|绉|璧|鎶|鐭|瀹|浠|娓|闂|闈|鈥|鈱|鈻/.test(text)) {
    fail(`${file} must not contain mojibake or corrupted Chinese text`);
  }
  for (const retiredTerm of retiredVisibleTerms) {
    if (text.includes(retiredTerm)) {
      fail(`${file} must not expose retired UI term: ${retiredTerm}`);
    }
  }
}

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

for (const scene of requiredMiniappChildScenes) {
  const requiredRoute = `pages/entry-detail/entry-detail?scene=${scene}`;
  if (!routesJs.includes(requiredRoute) || !manifestText.includes(requiredRoute)) {
    fail(`web route contracts must preserve active entry-detail parity: ${requiredRoute}`);
  }
}

for (const entry of entries) {
  if (entry.id === 'home' || entry.webOnly) continue;
  const expectedScene = entry.id === 'map' ? 'today' : entry.id;
  const expectedRoute = `pages/entry-detail/entry-detail?scene=${expectedScene}`;
  if (!String(entry.miniappParity || '').includes(expectedRoute)) {
    fail(`entry ${entry.id} must declare miniapp child-scene parity: ${expectedRoute}`);
  }
}

const lobsterEntry = entries.find((entry) => entry.id === 'lobster');
if (!lobsterEntry || lobsterEntry.webOnly !== true || !String(lobsterEntry.miniappParity || '').includes('web-only')) {
  fail('web manifest must expose lobster as a web-only AI teacher product entry');
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
  'hero-mascot.png',
  'gudian-fullbody-transparent.png',
  'report-radar-card-illustration.png',
  'upload-folder-stack-transparent.png',
  'review-world-map-transparent.png',
  'family-avatar-group-transparent.png',
  'tutor-socratic-board-transparent.png',
  'learning-route-map-transparent.png'
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
  'entry-map.png',
  'gudian-fullbody-transparent.png',
  'report-radar-card-illustration.png',
  'upload-folder-stack-transparent.png',
  'review-world-map-transparent.png',
  'family-avatar-group-transparent.png',
  'tutor-socratic-board-transparent.png',
  'learning-route-map-transparent.png'
]) {
  if (!appJs.includes(`'${requiredAsset}'`)) {
    fail(`apps/web/src/app.js must route navigation through ${requiredAsset}`);
  }
}

for (const requiredSnippet of [
  "['lobster', '龙虾 AI 教师', 'hero-mascot.png']",
  "function renderLobster()",
  "data-action=\"lobster-configure\"",
  "data-action=\"lobster-coview\"",
  "window.location.href = '/lobster.html'"
]) {
  if (!appJs.includes(requiredSnippet) && !routesJs.includes(requiredSnippet)) {
    fail(`web lobster entry must expose the unified AI teacher workflow: ${requiredSnippet}`);
  }
}

for (const [route, assetName] of [
  ['upload', 'entry-upload.png'],
  ['report', 'entry-report.png'],
  ['tutor', 'entry-tutor.png'],
  ['review', 'entry-review.png'],
  ['parent', 'entry-parent.png'],
  ['map', 'entry-map.png']
]) {
  const viewModelPattern = new RegExp(`id: '${route}'[\\s\\S]*?image: '${assetName}'`);
  if (!viewModelPattern.test(viewModelJs) || !appJs.includes('class="entry-visual" src="${referenceAsset(card.image)}"')) {
    fail(`web home entry ${route} must stay image-led with reference asset ${assetName}`);
  }
}

for (const [route, visualMarker] of [
  ['upload', '<section class="upload-console"'],
  ['report', '<section class="report-hero pro card"'],
  ['tutor', '<section class="tutor-lab"'],
  ['review', '<section class="review-world card"'],
  ['parent', '<section class="parent-proof-summary"'],
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
  '.recall-module-card.purple'
]) {
  if (appJs.includes(forbiddenSnippet) || appCss.includes(forbiddenSnippet) || viewModelJs.includes(forbiddenSnippet)) {
    fail(`web UI must not regress to retired symbolic color design: ${forbiddenSnippet}`);
  }
}

if (appJs.includes('⇧ 选择文件')) {
  fail('web upload CTA must not use symbolic arrow text from the old design');
}

if (appJs.includes('reward])') || appJs.includes('${reward}')) {
  fail('web review cards must use evidence language, not retired reward variables');
}

for (const retiredVisualCss of [
  '.art-folder',
  '.art-report',
  '.art-bot',
  '.art-gamepad',
  '.art-family',
  '.art-map',
  '.entry-card::before',
  '.entry-visual::before',
  '.entry-visual::after',
  '.mascot {',
  '.island',
  '.challenge',
  '.challenge-grid',
  '.challenge-tile',
  '.level-card',
  '.mini-game-card',
  '.mini-game-grid',
  '.review-mini-games',
  '.parent-dashboard'
]) {
  if (appHtml.includes(retiredVisualCss) || appJs.includes(retiredVisualCss) || appCss.includes(retiredVisualCss)) {
    fail(`web UI must not keep retired CSS-drawn visual system: ${retiredVisualCss}`);
  }
}

for (const decorativeHeroOrb of [
  'radial-gradient(circle at 9% 30%',
  'radial-gradient(circle at 14% 48%',
  'radial-gradient(circle at 87% 22%'
]) {
  if (appCss.includes(decorativeHeroOrb)) {
    fail(`web home hero must rely on reference assets instead of decorative orb background: ${decorativeHeroOrb}`);
  }
}

for (const requiredCss of [
  '.brand-mark',
  '.nav-list a img',
  '.mobile-tabs a img',
  '.route-line img',
  '.step-list li img',
  '.evidence-strip.visual img',
  'grid-template-columns: 58px minmax(0, 1fr)',
  'text-align: left',
  'url("../assets/reference/brand-house.png")'
]) {
  if (!appCss.includes(requiredCss)) {
    fail(`apps/web/src/styles.css must style reference image assets: ${requiredCss}`);
  }
}

if (/object-fit:\s*cover/.test(appCss)) {
  fail('web reference imagery must preserve native proportions instead of cropping with object-fit: cover');
}

[
  ['.brand-mark', ['width: 42px', 'height: 42px', 'object-fit: contain'], 'web brand mark preserves the reference image ratio'],
  ['.nav-list a img', ['width: 34px', 'height: 34px', 'object-fit: contain'], 'web desktop nav icons preserve the reference image ratio'],
  ['.web-scene-switch img', ['width: 44px', 'height: 44px', 'object-fit: contain'], 'web compact scene-switch icons preserve the reference image ratio'],
  ['.entry-visual', ['width: 154px', 'height: 132px', 'object-fit: contain'], 'web home entry illustrations preserve the reference image ratio'],
  ['.student-id-card img', ['width: 118px', 'height: 102px', 'object-fit: contain'], 'web report hero image preserves the reference image ratio'],
  ['.chat-head > img', ['width: 86px', 'height: 86px', 'object-fit: contain'], 'web tutor board image preserves the reference image ratio'],
  ['.review-buddy-card img', ['width: 94px', 'height: 94px', 'object-fit: contain'], 'web review title image preserves the reference image ratio'],
  ['.review-world-art', ['width: min(36%, 310px)', 'height: auto', 'object-fit: contain'], 'web review world image preserves the reference image ratio'],
  ['.world-node img', ['width: 70px', 'height: 58px', 'object-fit: contain'], 'web review node images preserve the reference image ratio'],
  ['.recall-module-card img', ['width: 112px', 'height: 92px', 'object-fit: contain'], 'web recall-card images preserve the reference image ratio'],
  ['.evidence-flow-card img', ['width: 78px', 'height: 70px', 'object-fit: contain'], 'web review evidence images preserve the reference image ratio'],
  ['.student-face img', ['width: 98px', 'height: 98px', 'object-fit: contain'], 'web parent family avatar preserves the reference image ratio'],
  ['.parent-mini-mascot', ['width: 72px', 'height: 72px', 'object-fit: contain'], 'web parent mascot preserves the reference image ratio'],
  ['.parent-proof-grid img', ['width: 62px', 'height: 56px', 'object-fit: contain'], 'web parent evidence images preserve the reference image ratio'],
  ['.route-line img', ['width: 46px', 'height: 46px', 'object-fit: contain'], 'web route-line images preserve the reference image ratio'],
  ['.step-list li img', ['width: 30px', 'height: 30px', 'object-fit: contain'], 'web progress-list images preserve the reference image ratio'],
  ['.evidence-strip.visual img', ['width: 38px', 'height: 38px', 'object-fit: contain'], 'web right-rail evidence images preserve the reference image ratio'],
  ['.upload-art-img', ['width: 188px', 'height: 160px', 'object-fit: contain'], 'web upload hero image preserves the reference image ratio'],
  ['.type-card.visual img', ['width: 72px', 'height: 72px', 'object-fit: contain'], 'web upload type images preserve the reference image ratio'],
  ['.learning-road-art', ['width: min(34%, 340px)', 'height: auto', 'object-fit: contain'], 'web route-map hero image preserves the reference image ratio'],
  ['.road-stop img', ['width: 74px', 'height: 64px', 'object-fit: contain'], 'web route-stop images preserve the reference image ratio'],
  ['.road-cheer img', ['width: 74px', 'height: 60px', 'object-fit: contain'], 'web route mascot image preserves the reference image ratio'],
  ['.mobile-tabs a img', ['width: 28px', 'height: 28px', 'object-fit: contain'], 'web mobile tab icons preserve the reference image ratio']
].forEach(([selector, required, message]) => {
  cssRuleContains(appCss, selector, required, message);
});

if (appCss.includes('grid-template-rows: 76px minmax(0, 1fr)')) {
  fail('mobile home entry cards must stay horizontal image-left cards, not stacked tiles');
}

for (const requiredSnippet of [
  'const progressAssetById',
  'class="route-line visual"',
  'class="evidence-strip visual"',
  'referenceAsset(progressAssetById[item.id]',
  '<img src="${referenceAsset(image)}"'
]) {
  if (!appJs.includes(requiredSnippet)) {
    fail(`apps/web/src/app.js must keep the home route and right rail image-led: ${requiredSnippet}`);
  }
}

for (const retiredRouteSnippet of [
  '<i>${item.done ?',
  '<span>${item.done ?',
  '<span>试卷<small>2份</small></span>'
]) {
  if (appJs.includes(retiredRouteSnippet)) {
    fail(`web home route/right rail must not regress to number-only or text-only blocks: ${retiredRouteSnippet}`);
  }
}

if (!appJs.includes("['home', 'tutor', 'review', 'parent', 'upload'].includes(id)")) {
  fail('web mobile tab bar must mirror the miniapp five-tab shell: home, tutor, review, parent, upload');
}

for (const mobileAsset of [
  'brand-house.png',
  'entry-tutor.png',
  'entry-review.png',
  'entry-parent.png',
  'entry-upload.png'
]) {
  if (!appJs.includes(mobileAsset)) {
    fail(`web mobile tab bar must use reference asset: ${mobileAsset}`);
  }
}

if (!appCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr))')) {
  fail('web mobile tab bar must render five fixed reference-image tabs');
}

console.log(`Web surface check passed for ${entries.length} entries.`);
