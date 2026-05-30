const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const docPath = path.join(root, 'docs', 'MINIAPP-REFERENCE-ADOPTION.md');
assert(fs.existsSync(docPath), 'miniapp reference adoption doc exists');

const doc = fs.readFileSync(docPath, 'utf8');
[
  'Direct-Use Assets',
  'Reference-Only Inputs',
  'Must Be Implemented In Code',
  'Forbidden Regressions',
  'Current Image2 Asset Need',
  'No extra Image2 asset is required'
].forEach((section) => {
  assert(doc.includes(section), `miniapp reference adoption doc includes ${section}`);
});

const referenceAssets = [
  'brand-house.png',
  'hero-mascot.png',
  'gudian-sticker.png',
  'entry-upload.png',
  'entry-report.png',
  'entry-tutor.png',
  'entry-review.png',
  'entry-parent.png',
  'entry-map.png'
];

for (const asset of referenceAssets) {
  const miniappAsset = path.join(root, 'miniprogram', 'assets', 'reference', asset);
  const webAsset = path.join(root, 'apps', 'web', 'assets', 'reference', asset);
  assert(fs.existsSync(miniappAsset), `miniapp reference asset exists: ${asset}`);
  assert(fs.existsSync(webAsset), `web mirrored reference asset exists: ${asset}`);
  assert.strictEqual(
    fs.statSync(webAsset).size,
    fs.statSync(miniappAsset).size,
    `web and miniapp reference asset sizes match: ${asset}`
  );
  assert(doc.includes(asset), `adoption doc explains asset: ${asset}`);
}

const activeMiniappSource = [
  'home/home',
  'upload/upload',
  'tutor/tutor',
  'review/review',
  'arcade/arcade',
  'profile/profile',
  'entry-detail/entry-detail'
].map((page) => {
  const [dir, base] = page.split('/');
  return [
    read(`miniprogram/pages/${dir}/${base}.wxml`),
    read(`miniprogram/pages/${dir}/${base}.wxss`)
  ].join('\n');
}).join('\n');

[
  ['home', 'glow'].join('-'),
  ['review', 'glow'].join('-'),
  ['profile', 'glow'].join('-'),
  ['hero', 'orbit'].join('-'),
  ['hero', 'core'].join('-'),
  ['hero', 'dot'].join('-'),
  ['ux', 'kit', 'subcheck'].join('-'),
  ['mole', 'grid'].join('-'),
  ['mole', 'hole'].join('-'),
  ['mole', 'face'].join('-'),
  ['mole', 'label'].join('-'),
  ['mini', 'home', 'shell'].join('-'),
  ['upload', 'hero', 'shell'].join('-'),
  ['review', 'hero', 'shell'].join('-'),
  ['tutor', 'hero', 'shell'].join('-'),
  ['arcade', 'hero', 'shell'].join('-'),
  ['parent', 'hero', 'shell'].join('-')
].forEach((term) => {
  assert(!activeMiniappSource.includes(term), `active miniapp source does not keep forbidden old UI term: ${term}`);
});

const homeWxml = read('miniprogram/pages/home/home.wxml');
assert.strictEqual((homeWxml.match(/mini-entry-card ux-kit-jump-card/g) || []).length, 6, 'home uses one shared visual card system for six entries');
['upload', 'report', 'tutor', 'review', 'parent', 'today'].forEach((scene) => {
  assert(homeWxml.includes(`data-scene="${scene}"`), `home exposes scene ${scene}`);
});

const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
assert(entryDetailJs.includes("report: {"), 'entry-detail has a dedicated report scene');
assert(entryDetailJs.includes("secondaryRoute: '/pages/profile/profile?from=entry_upload_quiz&panel=assessment&quick_assessment=1'"), 'upload quick assessment route jumps to questionnaire flow');
assert(!entryDetailJs.includes("secondaryRoute: '/pages/entry-detail/entry-detail?scene=upload"), 'upload secondary route does not self-loop');

const webRoutes = read('apps/web/src/routes.js');
const webManifest = read('apps/web/surface-manifest.json');
assert(webRoutes.includes('pages/entry-detail/entry-detail?scene=report'), 'web report route contract includes miniapp report child scene');
assert(webManifest.includes('pages/entry-detail/entry-detail?scene=report'), 'web manifest includes miniapp report child scene');

console.log('Miniapp reference adoption checks pass.');
