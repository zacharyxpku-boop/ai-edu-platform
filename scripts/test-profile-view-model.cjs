const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');

[
  'buildTonightParentDecisionCard',
  'familyDecisionHomepageStatusSteps',
  'runFamilyDecisionHomepageAction',
  'runUploadedMaterialDossierAction',
  'partnerDeliveryWorkbench',
  'openMaicBorrowWorkbench',
  'longTermPortraitCanRender'
].forEach((token) => {
  assert(profileJs.includes(token), `profile JS keeps capability: ${token}`);
});

[
  'yd-parent-screen',
  'yd-parent-evidence',
  'parent-report-preview',
  'yd-parent-action-row',
  'yd-parent-route',
  'yd-parent-route'
].forEach((token) => {
  assert(profileWxml.includes(token), `profile WXML keeps new-shell capability: ${token}`);
});

[
  'parent-report-capability-panel',
  'learningReportSummary.crossWeekTrendRows',
  'learningReportSummary.homeSchoolEvidencePacket',
  'uploadedMaterialDecisionDossierMethodCandidateCards',
  'uploadedMaterialDecisionDossierWrongPaperDiagnosisCards',
  'tonight-parent-decision-card',
  'growth-memory-card'
].forEach((token) => {
  assert(!profileWxml.includes(token), `profile WXML does not render retired detailed ledger: ${token}`);
});

assert(profileViewModelJs.includes('primaryCta') && profileViewModelJs.includes('信任边界'), 'profile view model keeps parent-readable CTA and trust boundary');

[
  'partnerWorkbenchCrmExport.allowedFields',
  'partnerWorkbenchCrmExport.blockedFields',
  ['show','Leg','acyEntryContent'].join(''),
  ['rc','14-profile-first-screen'].join(''),
  ['v','1-topbar'].join(''),
  ['family','summary-card'].join('-')
].forEach((token) => {
  assert(!profileWxml.includes(token), `profile WXML avoids raw/retired marker: ${token}`);
});

console.log('All profile view-model tests pass.');
