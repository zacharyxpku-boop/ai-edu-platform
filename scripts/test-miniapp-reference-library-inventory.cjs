const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const referenceLibraryRoot = 'C:\\Users\\86136\\Desktop\\小程序';

const productionReferenceAssets = [
  'brand-house.png',
  'hero-mascot.png',
  'gudian-sticker.png',
  'entry-upload.png',
  'entry-report.png',
  'entry-tutor.png',
  'entry-review.png',
  'entry-parent.png',
  'entry-map.png',
  'family-avatar-group-transparent.png',
  'gudian-fullbody-transparent.png',
  'learning-route-map-transparent.png',
  'report-radar-card-illustration.png',
  'review-world-map-transparent.png',
  'tutor-socratic-board-transparent.png',
  'upload-folder-stack-transparent.png'
];

const referenceScreenshotInputs = [
  'assets/img/miniapp-home.png',
  'assets/img/mobile-home.png',
  'assets/img/mobile-report.png',
  'assets/img/home-desktop.png',
  'assets/img/upload-desktop.png',
  'assets/img/report-desktop.png',
  'assets/img/tutor-desktop.png',
  'assets/img/review-desktop.png',
  'assets/img/parent-desktop.png',
  'assets/img/map-desktop.png'
];

const optionalHtml = [
  'index.html',
  'upload.html',
  'report.html',
  'tutor.html',
  'review.html',
  'parent.html',
  'map.html',
  'mobile-home.html',
  'mobile-report.html',
  'miniapp-home.html'
];

assert(fs.existsSync(referenceLibraryRoot), `reference library exists: ${referenceLibraryRoot}`);

referenceScreenshotInputs.forEach((file) => {
  const target = path.join(referenceLibraryRoot, file);
  assert(fs.existsSync(target), `reference screenshot input exists when using desktop library: ${file}`);
  assert(fs.statSync(target).size > 0, `reference screenshot input is non-empty: ${file}`);
});

optionalHtml.forEach((file) => {
  const target = path.join(referenceLibraryRoot, file);
  if (fs.existsSync(target)) {
    assert(fs.statSync(target).size > 0, `optional reference HTML is non-empty when present: ${file}`);
  }
});

productionReferenceAssets.forEach((file) => {
  const miniappAsset = path.join(root, 'miniprogram', 'assets', 'reference', file);
  const webAsset = path.join(root, 'apps', 'web', 'assets', 'reference', file);
  assert(fs.existsSync(miniappAsset), `miniapp production reference asset exists: ${file}`);
  assert(fs.statSync(miniappAsset).size > 0, `miniapp production reference asset is non-empty: ${file}`);
  assert(fs.existsSync(webAsset), `web mirrored reference asset exists: ${file}`);
});

const doc = fs.readFileSync(path.join(root, 'docs', 'MINIAPP-REFERENCE-ADOPTION.md'), 'utf8');
assert(doc.includes('No extra Image2 asset is required now.'), 'reference adoption doc confirms no extra Image2 asset is required now');
assert(doc.includes('Recommended Image2 prompt shape'), 'reference adoption doc still documents the prompt shape for future assets');

console.log('Miniapp reference library inventory passed.');
