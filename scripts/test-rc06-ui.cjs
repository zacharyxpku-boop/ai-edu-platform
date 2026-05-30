const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const homeWxml = read('miniprogram/pages/home/home.wxml');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const homeWxss = read('miniprogram/pages/home/home.wxss');
const tutorWxss = read('miniprogram/pages/tutor/tutor.wxss');
const arcadeWxss = read('miniprogram/pages/arcade/arcade.wxss');
const reviewWxss = read('miniprogram/pages/review/review.wxss');
const profileWxss = read('miniprogram/pages/profile/profile.wxss');

assert(homeWxml.includes('mini-home-shell') && homeWxml.includes('mini-route-card'), 'home uses the new compact reference shell');
assert(homeWxml.includes('mini-route-input') && homeWxml.includes('homeViewModel.inputCard.placeholder'), 'home keeps first-step input without the old composer shell');
assert(homeWxml.includes('mini-entry-grid') && (homeWxml.match(/mini-entry-visual/g) || []).length >= 6, 'home keeps visual entry cards');

assert(tutorWxml.includes('tutor-hero-shell') && tutorWxml.includes('tutor-entry-grid'), 'tutor uses the compact first-step jump shell');
assert(arcadeWxml.includes('arcade-hero-shell') && arcadeWxml.includes('ux-kit-jump-grid'), 'arcade uses the compact review island jump shell');

assert(reviewWxml.includes('review-hero-shell') && reviewWxml.includes('review-challenge-grid'), 'review uses the new challenge shell');
assert(reviewWxml.includes('review-main-cta') && reviewWxml.includes('review-subcheck'), 'review keeps primary action and a compact subcheck');
assert(reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && reviewWxml.includes('review-challenge-card'), 'review keeps the actionable verdict and compact challenge cards');

assert(profileWxml.includes('parent-hero-shell') && profileWxml.includes('parent-dash-evidence'), 'profile uses the new parent evidence shell');
assert(profileWxml.includes('parent-report-preview') && profileWxml.includes('parent-dash-route'), 'profile keeps report preview and next-step jump cards');
assert(!profileWxml.includes('parent-report-capability-panel'), 'profile retired detailed evidence ledger is not rendered');

[homeWxss, tutorWxss, arcadeWxss, reviewWxss, profileWxss].forEach((css) => {
  assert(css.includes('env(safe-area-inset-bottom)'), 'tab page keeps bottom safe-area padding');
});

const fourTabs = [homeWxml, tutorWxml, arcadeWxml, reviewWxml, profileWxml].join('\n');
['秒解', '拍照出答案', '答案已生成', '直接答案', '标准答案如下', '看答案', '参考答案', '正确答案'].forEach((term) => {
  assert(!fourTabs.includes(term), `four tab pages avoid unsafe answer wording: ${term}`);
});

[['show','Leg','acyEntryContent'].join(''), ['page','positioning'].join('-'), ['rc','14-'].join(''), ['v','1-topbar'].join(''), ['composer','shell'].join('-'), ['family','summary-card'].join('-')].forEach((term) => {
  assert(!fourTabs.includes(term), `four tab pages do not render retired UI marker: ${term}`);
});

console.log('All RC0.6 UI reduction tests pass.');
