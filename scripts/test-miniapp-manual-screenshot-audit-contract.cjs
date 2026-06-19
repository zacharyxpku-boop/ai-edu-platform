const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const auditScriptPath = path.join(root, 'scripts', 'audit-miniapp-manual-screenshots.cjs');
const fullcheckPath = path.join(root, 'scripts', 'miniapp-fullcheck.cjs');
const auditScript = fs.readFileSync(auditScriptPath, 'utf8');
const fullcheck = fs.readFileSync(fullcheckPath, 'utf8');

const expectedSlots = [
  'tab-tutor.png',
  'tab-review.png',
  'tab-parent.png',
  'tab-upload.png',
  'child-tutor-flow.png',
  'child-review-recall.png',
  'child-report-evidence.png',
  'child-parent-report.png',
  'child-upload-material.png',
  'entry-detail-tutor.png',
  'entry-detail-review.png',
  'entry-detail-report.png',
  'entry-detail-parent.png',
  'entry-detail-upload.png'
];

expectedSlots.forEach((name) => {
  assert(auditScript.includes(name), `manual screenshot audit keeps required slot: ${name}`);
});

const entryDetailSlots = expectedSlots.filter((name) => name.startsWith('entry-detail-'));
assert.strictEqual(entryDetailSlots.length, 5, 'contract covers five active pre-click entry-detail screenshots');

[
  'expectedManualSlots',
  'expectedManualSequence',
  'missingExpectedSlots',
  'renamePlan',
  'renameSuggestions',
  'qualityIssues',
  'unassignedScreenshots',
  'STALE_OR_INCOMPLETE'
].forEach((token) => {
  assert(auditScript.includes(token), `manual screenshot audit emits ${token}`);
});

[
  'stale_before_current_source',
  'non_semantic_filename',
  'unusual_phone_aspect_ratio',
  'over_tall_capture_check_frame_or_scrollshot',
  'height_outlier_check_crop_or_device_frame'
].forEach((issue) => {
  assert(auditScript.includes(issue), `manual screenshot audit detects ${issue}`);
});

[
  "latestMtimeMs(path.join(projectPath, 'pages'))",
  "latestMtimeMs(path.join(projectPath, 'custom-tab-bar'))",
  "latestMtimeMs(path.join(projectPath, 'assets', 'reference'))",
  "path.join(projectPath, 'app.json')",
  "path.join(projectPath, 'app.wxss')"
].forEach((source) => {
  assert(auditScript.includes(source), `manual screenshot audit compares against current source mtime: ${source}`);
});

[
  'manual-real-screenshot-audit.html',
  'manual-real-screenshot-audit.png',
  'manual-real-screenshot-audit.json',
  'MANUAL-REAL-SCREENSHOT-AUDIT.md'
].forEach((artifact) => {
  assert(auditScript.includes(artifact), `manual screenshot audit writes ${artifact}`);
});

assert(
  auditScript.includes('process.env.MINIAPP_REAL_SCREENSHOT_DIR'),
  'manual screenshot audit can be pointed at a supplied screenshot directory'
);
assert(
  fullcheck.includes('scripts/test-miniapp-manual-screenshot-audit-contract.cjs'),
  'miniapp fullcheck runs the manual screenshot audit contract'
);

console.log('Miniapp manual screenshot audit contract passed.');
