#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const appJson = JSON.parse(read('miniprogram/app.json'));
const tabLabels = appJson.tabBar.list.map((item) => item.text);
assert.strictEqual(tabLabels.length, 5, 'miniapp keeps five main tabs');

const customTab = read('miniprogram/custom-tab-bar/index.wxml');
tabLabels.forEach((label) => {
  assert(customTab.includes(label), `custom tab renders ${label}`);
});

const files = {
  home: read('miniprogram/pages/home/home.wxml'),
  tutor: read('miniprogram/pages/tutor/tutor.wxml'),
  review: read('miniprogram/pages/review/review.wxml'),
  profile: read('miniprogram/pages/profile/profile.wxml'),
  upload: read('miniprogram/pages/upload/upload.wxml'),
  arcade: read('miniprogram/pages/arcade/arcade.wxml')
};

assert(files.home.includes('mini-home-shell') && files.home.includes('mini-entry-grid'), 'home uses the new reference jump shell');
assert(files.tutor.includes('tutor-hero-shell') && files.tutor.includes('tutor-entry-grid'), 'tutor uses the new reference jump shell');
assert(files.review.includes('review-hero-shell') && files.review.includes('review-challenge-grid'), 'review uses the new reference jump shell');
assert(files.profile.includes('parent-hero-shell') && files.profile.includes('parent-dash-evidence'), 'profile stays parent evidence and recap oriented');
assert(files.upload.includes('upload-hero-shell') && files.upload.includes('upload-material-card'), 'upload stays material intake oriented through compact jump cards');
assert(!files.upload.includes('upload-intake-panel'), 'upload no longer renders the retired intake panel');

const routeShellText = Object.values(files).join('\n') + '\n' + customTab;
[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-'),
  '知识游乐场',
  '错题闭环',
  '复习闯关',
  '知识闯关',
  '知识关卡',
  '同学同关练',
  '请老师看一看',
  '学习游戏档案',
  '免费体验',
  '支付',
  '课程售卖',
  '访谈验证',
  '学币',
  'PK',
  '排行榜'
].forEach((term) => {
  assert(!routeShellText.includes(term), `route shell avoids retired or commercial wording: ${term}`);
});

[
  'openEntryDetail',
  'goProfile',
  'goReportPreview',
  'goLearningMap',
  'runPlaybookAction'
].forEach((handler) => {
  assert(routeShellText.includes(handler), `route shell keeps clickable handler: ${handler}`);
});

const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
assert(arcadeJs.includes('openEntryDetail') && arcadeJs.includes('entry-detail'), 'arcade routes review island cards through entry-detail');

console.log('All RC5 product shell tests pass.');
