const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const appJs = read('miniprogram/app.js');
const storageJs = read('miniprogram/utils/storage.js');
const focusCabinJs = read('miniprogram/utils/focus-cabin.js');
const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');

assert(focusCabinJs.includes('parentPausePrompt'), 'Focus cabin can build parent pause phrase');
assert(appJs.includes('archiveYesterdaySession'), 'app launch archives yesterday session');
assert(homeJs.includes('yesterdayReviewCard') && homeJs.includes('continueYesterdayReview'), 'home can read and route yesterday review card');
assert(homeWxml.includes('route-next-lite') && homeWxml.includes('runHomeNextStep'), 'home renders a compact cross-day next-step route');
assert(reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && reviewWxml.includes('review-challenge-card'), 'review carries the repaired first-step evidence as compact actions');
assert(tutorWxml.includes('tutor-entry-grid') && arcadeWxml.includes('data-scene="tutor"'), 'tutor and arcade can continue or return to the first step');
assert(profileWxml.includes('yd-parent-loop'), 'profile closes the loop with a family next step');
assert(storageJs.includes('isYesterday') && storageJs.includes('archiveYesterdaySession'), 'storage supports cross-day review boundary');

console.log('All single-loop punchthrough tests pass.');
