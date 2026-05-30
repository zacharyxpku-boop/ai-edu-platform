const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const appJson = JSON.parse(read('miniprogram/app.json'));
const retiredPages = ['daily-math', 'dictation', 'light-diagnosis', 'focus', 'tools', 'module', 'radar', 'diagnosis'];
retiredPages.forEach((page) => {
  const pagePath = `pages/${page}/${page}`;
  assert(!appJson.pages.includes(pagePath), `${pagePath} is retired from the active app registry`);
  assert(!fs.existsSync(path.join(root, 'miniprogram', 'pages', page)), `${pagePath} directory is physically removed`);
});

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');

assert(homeJs.includes('openEntryDetail'), 'Home routes retired light entries through the active jump shell');
assert(!/\/pages\/(?:daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//.test(homeJs), 'Home no longer routes directly to retired pages');
assert(homeWxml.includes('mini-entry-grid') && homeWxml.includes('mini-route-card'), 'Home exposes the new compact product route');
assert(entryDetailJs.includes('const SCENES') && entryDetailWxml.includes('bindtap="openScene"'), 'Entry detail replaces retired light/heavy subpages with scene jumps');
assert(entryDetailJs.includes("primaryRoute: '/pages/tutor/tutor") && entryDetailJs.includes("primaryRoute: '/pages/review/review"), 'Entry detail sends light actions into active tutor/review pages');
assert(tutorWxml.includes('tutor-hero-shell'), 'Tutor owns first-step work in the active shell');
assert(reviewWxml.includes('review-hero-shell') && reviewWxml.includes('review-challenge-grid'), 'Review owns recall and transfer in the active shell');
assert(!profileWxml.includes('focusCabinSummary') && profileWxml.includes('parent-dash-evidence'), 'Profile exposes parent evidence without the retired focus cabin panel');

const visible = [homeWxml, entryDetailWxml, tutorWxml, reviewWxml, profileWxml].join('\n');
['PK', '冲榜', '排名', '提分', '秒解答案', '答案已生成', '必须打卡'].forEach((term) => {
  assert(!visible.includes(term), `Visible light/heavy copy avoids ${term}`);
});

console.log('All light-heavy service loop tests pass.');
