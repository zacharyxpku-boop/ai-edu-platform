const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeVm: read('miniprogram/view-models/home-view-model.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewVm: read('miniprogram/view-models/review-view-model.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileVm: read('miniprogram/view-models/profile-view-model.js'),
  pilotTemplate: read('docs/pilot-observation-template.md'),
  packageJson: read('package.json')
};

assert(files.homeWxml.includes('yd-home-screen'), 'home uses the new first-day shell');
assert(files.homeWxml.includes('homeViewModel.emptyState') && files.homeVm.includes('emptyState'), 'home first-run empty state is view-model driven');
assert(!files.homeWxml.includes('homeViewModel.teacherPickerHint') && files.homeVm.includes('teacherPickerHint'), 'home companion hint stays view-model driven without crowding the first screen');
assert(files.homeWxml.includes('homeViewModel.nextStep.text') && files.homeWxml.includes('homeViewModel.nextStep.cta'), 'home renders next step from homeViewModel');
assert(files.homeWxml.includes('catchtap="runHomeNextStep"'), 'home main CTA dispatches the view-model next action');

assert(files.reviewWxml.includes('yd-review-screen'), 'review uses the new challenge shell');
assert(files.reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && files.reviewWxml.includes('review-challenge-card'), 'review keeps first repair evidence as compact challenge cards');
assert(!files.reviewWxml.includes('reviewViewModel.emptyState') && files.reviewVm.includes('emptyState'), 'review first-run empty state stays in logic without adding a second visible CTA');
assert(files.reviewWxml.includes('data-scene="tutor"') && files.reviewWxml.includes('data-scene="today"'), 'review can route back to first-step and next-route cards');

assert(files.tutorWxml.includes('yd-tutor-screen') && files.tutorWxml.includes('tutor-entry-grid'), 'tutor uses the compact first-step shell');
assert(files.arcadeWxml.includes('yd-arcade-screen') && files.arcadeWxml.includes('ux-kit-jump-grid'), 'arcade uses the compact review island shell');
assert(files.arcadeWxml.includes('data-scene="tutor"') && files.arcadeWxml.includes('data-scene="parent"'), 'arcade routes back to tutor and parent evidence instead of a retired tools page');

assert(files.profileWxml.includes('yd-parent-screen'), 'profile uses the new parent shell');
assert(files.profileWxml.includes('yd-parent-loop') && files.profileVm.includes('oneNightProof'), 'profile keeps the family next-step proof line');
assert(!files.profileWxml.includes('growth-memory-card') && files.profileVm.includes('growthMemoryCard'), 'profile keeps growth memory in logic without rendering another card');

[
  'selectedCompanion',
  'createdTonightPlan',
  'createdTodayFocus',
  'startedRepair',
  'completedMiniAction',
  'completedRepair',
  'createdReviewCard',
  'visitedToolsAfterRepair',
  'visitedProfileAfterReview'
].forEach((field) => {
  assert(files.pilotTemplate.includes(field), `pilot observation template includes ${field}`);
});

const tabUi = [files.homeWxml, files.reviewWxml, files.tutorWxml, files.arcadeWxml, files.profileWxml].join('\n');
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-')
].forEach((term) => {
  assert(!tabUi.includes(term), `first-day tabs do not carry retired UI marker: ${term}`);
});

assert(files.packageJson.includes('scripts/test-rc11-first-day.cjs'), 'npm test includes RC1.1 first-day usability guard');

console.log('All RC1.1 first-day usability tests pass.');
