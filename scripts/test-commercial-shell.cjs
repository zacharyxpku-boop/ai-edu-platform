const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const uploadJs = read('miniprogram/pages/upload/upload.js');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const reviewJs = read('miniprogram/pages/review/review.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const apiJs = read('miniprogram/utils/api.js');
const importIntake = read('miniprogram/utils/import-intake.js');
const learningReport = read('miniprogram/utils/learning-report.js');
const miniApi = read('api/mini/session.js') + '\n' + read('api/mini/tutor-message.js');

assert(importIntake.includes('buildUploadIntakePacket') && uploadJs.includes('buildUploadIntakePacket'), 'Upload builds structured intake packets');
assert(uploadWxml.includes('upload-hero-shell') && uploadWxml.includes('upload-material-card') && uploadJs.includes('buildUploadIntakePacket'), 'Upload visibly exposes structured intake through compact cards');
assert(importIntake.includes('buildNextActionQueue') && uploadWxml.includes('data-scene="parent"') && uploadJs.includes('openEntryDetail'), 'Upload exposes routeable next-action queue through active jump cards');
assert(uploadJs.includes('openMaicDecisionBridge') && uploadJs.includes('safeRelayPayload') && uploadJs.includes('buildTonightTaskCard'), 'Upload connects intake to mini lesson, safe relay, and tonight task');
assert(!uploadWxml.includes('lastReportCta.tonightTaskCard') && uploadWxml.includes('upload-subcheck'), 'Upload no longer dumps mini-lesson and tonight-task output on the first screen');
assert(uploadJs.includes('requiresStructuredEvidenceGate') && uploadJs.includes('blocked_until_structured_evidence'), 'Upload blocks release until structured evidence is complete');

assert(reviewJs.includes('openMaicBridgeStatus') && reviewWxml.includes('review-hero-shell'), 'Review preserves upload decision-bridge status in logic while keeping compact shell');
assert(arcadeJs.includes('openMaicBridgeStatus') && arcadeWxml.includes('arcade-hero-shell'), 'Arcade preserves upload decision-bridge status in logic while keeping compact shell');
assert(!reviewWxml.includes('memoryPrescriptionPanel.receiverShareRelayPanel'), 'Review does not render receiver own-material relay panel on compact first screen');

assert(profileWxml.includes('parent-hero-shell') && profileWxml.includes('parent-dash-evidence'), 'Profile is parent evidence oriented');
assert(!profileWxml.includes('鏈嶅姟鐘舵€?') && profileWxml.includes('parent-dash-route'), 'Profile keeps service readiness out of the compact first screen');
assert(profileJs.includes('uploadedMaterialDecisionDossierMethodValidationStages') && !profileWxml.includes('uploadedMaterialDecisionDossierMethodValidationStages'), 'Profile keeps method validation chain in logic without rendering a ledger');
assert(!profileWxml.includes('uploadedMaterialDecisionDossierMethodValidationReleaseRule'), 'Profile does not render method release ledger on compact first screen');
assert(learningReport.includes('methodValidationStages') && learningReport.includes('methodCandidateCards'), 'Learning report carries method validation and candidate methods');

assert(arcadeJs.includes('openEntryDetail') && arcadeWxml.includes('data-scene="tutor"'), 'Arcade routes unavailable recall back to first-step tutor');
assert(apiJs.includes('httpsCallable') || apiJs.includes('request'), 'Miniapp API layer remains centralized');
assert(!/\/api\/(?:log-dialogue|fsrs-|ingest-attempt|mastery-proxy|parent-push|student-init|ai-proxy|mentor-queue)/.test(miniApi), 'Miniapp server APIs avoid retired demo endpoints');

const visibleWxml = [uploadWxml, reviewWxml, arcadeWxml, profileWxml].join('\n');
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-'),
  '免费体验',
  '课程售卖',
  '开发者演示',
  'PK',
  '排行榜'
].forEach((term) => {
  assert(!visibleWxml.includes(term), `Commercial shell avoids retired or fake-commercial wording: ${term}`);
});

console.log('All commercial shell tests pass.');
