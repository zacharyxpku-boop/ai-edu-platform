const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewViewModelJs: read('miniprogram/view-models/review-view-model.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  profileViewModelJs: read('miniprogram/view-models/profile-view-model.js'),
  storageJs: read('miniprogram/utils/storage.js'),
  packageJson: read('package.json')
};

const screens = {
  home: files.homeWxml,
  review: files.reviewWxml,
  tutor: files.tutorWxml,
  arcade: files.arcadeWxml,
  profile: files.profileWxml
};

[
  ['home', files.homeWxml, 'mini-home-shell', 'homeViewModel.title', 'homeViewModel.primaryCta', 'mini-entry-grid'],
  ['review', files.reviewWxml, 'review-hero-shell', 'reviewViewModel.title', 'reviewViewModel.primaryCta.text', 'review-challenge-grid'],
  ['tutor', files.tutorWxml, 'tutor-hero-shell', 'tutor-entry-grid', 'openEntryDetail', 'tutor-entry-grid'],
  ['arcade', files.arcadeWxml, 'arcade-hero-shell', 'ux-kit-jump-grid', 'openEntryDetail', 'ux-kit-jump-grid'],
  ['profile', files.profileWxml, 'parent-hero-shell', 'profileViewModel.title', 'profileViewModel.primaryCta', 'parent-dash-evidence']
].forEach(([name, wxml, shell, title, cta, jump]) => {
  assert(wxml.includes(shell), `${name} renders the new reference shell`);
  assert(wxml.includes(title), `${name} first screen keeps the one main question`);
  assert(wxml.includes(cta), `${name} first screen keeps the main CTA`);
  assert(wxml.includes(jump), `${name} keeps compact jump/summary cards`);
  if (name === 'home' || name === 'review' || name === 'profile') {
    assert((wxml.match(/companion-route-strip/g) || []).length === 1, `${name} has exactly one mascot strip`);
  }
});

assert(files.homeWxml.includes('homeViewModel.inputCard.title') && files.homeViewModelJs.includes('inputCard'), 'home main card is the input card through homeViewModel');
assert(files.homeWxml.includes('homeViewModel.teacherPickerLabel') && files.homeViewModelJs.includes('teacherPickerLabel'), 'home keeps mascot cue through homeViewModel');
assert(files.homeWxml.includes('mini-route-card') && files.homeWxml.includes('route-next-lite'), 'home keeps tonight route and next step compact');
assert(files.homeWxml.includes('mini-route-node') && files.homeWxml.includes('mini-route-icon'), 'home route is a visual rail, not old number/check boxes');
assert(!files.homeWxml.includes('<view class="active"><text>3</text>'), 'home route does not show old active number boxes');

assert(files.reviewWxml.includes('{{reviewViewModel.primaryCta.text}}'), 'review main card renders one repair CTA from viewModel');
assert(!files.reviewWxml.includes('reviewViewModel.emptyState.cta') && files.reviewViewModelJs.includes('emptyState'), 'review empty state stays in logic without adding a second visible CTA');
assert(files.reviewWxml.includes('review-challenge-card'), 'review keeps compact challenge cards in the shell');

assert(files.tutorWxml.includes('data-scene="review"') && files.arcadeWxml.includes('data-scene="tutor"'), 'tutor and arcade cross-link first-step and review flows');
assert(files.arcadeWxml.includes('arcade-map-icon'), 'arcade route map is icon based');
assert(!files.arcadeWxml.includes('<view class="arcade-map-node active"><text>1</text>'), 'arcade route map does not show old numbered boxes');

assert(!files.profileWxml.includes('profileViewModel.growthMemoryCard') && files.profileViewModelJs.includes('growthMemoryCard'), 'profile keeps memory in logic instead of another visible card');
assert(files.profileWxml.includes('parent-dash-route'), 'profile shows family next step as a compact route');

const visibleTabCopy = Object.values(screens).join('\n');
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-'),
  'home_xiaodian_entry',
  'needs_student_step',
  'teacherTeamProfiles',
  'NOVA_TEACHER_PROFILES',
  'ERROR_TYPE_PROFILES',
  'dashboard',
  'OCR',
  'PK'
].forEach((term) => {
  assert(!visibleTabCopy.includes(term), `current first-screen visible/product copy avoids ${term}`);
});

assert(files.storageJs.includes('咕点') || files.storageJs.includes('鍜曠偣'), 'companion strip uses mascot wording');
assert(files.packageJson.includes('scripts/test-current-ui-first-screen.cjs'), 'npm test includes current first-screen first-screen guard');

console.log('All current first-screen first-screen UI tests pass.');
