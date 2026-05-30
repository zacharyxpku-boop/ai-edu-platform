const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const homeWxml = read('miniprogram/pages/home/home.wxml');
const homeJs = read('miniprogram/pages/home/home.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');

assert(homeWxml.includes('mini-entry-grid') && homeWxml.includes('mini-route-card'), 'Home renders reference-style entry cards and route card');
assert(homeJs.includes('openEntryDetail') && !/\/pages\/(?:daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//.test(homeJs), 'Home uses active jump shell instead of retired light practice routes');
assert(homeWxml.includes('openEntryDetail') && homeWxml.includes('goRadar') && homeWxml.includes('goTools'), 'Home entry cards are clickable');

assert(entryDetailJs.includes('const SCENES') && entryDetailWxml.includes('entry-jump-grid'), 'Entry detail replaces retired child pages');
assert(entryDetailWxml.includes('entry-primary') && entryDetailWxml.includes('entry-secondary'), 'Entry detail child scenes have clear actions');
assert(profileWxml.includes('parent-hero-shell') && profileWxml.includes('parent-dash-evidence'), 'Profile first screen is parent evidence oriented');
assert(profileWxml.includes('profileViewModel.primaryCta') && profileWxml.includes('parent-dash-route'), 'Profile keeps one CTA and family next step');
assert(profileJs.includes('saveLocalFeedback'), 'Profile feedback is local instead of customer service chat');

assert(reviewWxml.includes('review-hero-shell') && !reviewWxml.includes('reviewViewModel.blackboard.intro'), 'Review keeps repair without rendering dense blackboard evidence in the new shell');
assert(tutorWxml.includes('tutor-hero-shell') && arcadeWxml.includes('data-scene="tutor"'), 'Tutor and arcade can return to first-step flow');
assert(reviewWxml.includes('review-main-cta') && arcadeWxml.includes('arcade-hero-shell'), 'Review and arcade expose active compact CTAs');

const allVisible = [homeWxml, entryDetailWxml, profileWxml, reviewWxml, tutorWxml, arcadeWxml].join('\n');
['付费', '订阅', '解锁', '免费体验', '试听', '价格', '会员', '秒解', '拍照出答案', '答案已生成', 'PK', '排行榜'].forEach((term) => {
  assert(!allVisible.includes(term), `Friend-safe shell avoids ${term}`);
});

console.log('All friend-safe shell tests pass.');
