#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const storageMap = {};

global.wx = {
  getStorageSync(key) {
    return storageMap[key];
  },
  setStorageSync(key, value) {
    storageMap[key] = value;
  },
  removeStorageSync(key) {
    delete storageMap[key];
  }
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const full = path.join(root, filePath);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    wx: global.wx,
    Date,
    Math,
    String,
    Number,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const reviewCards = loadCommonJs(path.join('miniprogram', 'utils', 'review-cards.js'), {
  './storage': storage,
  './game-logic': {}
});
const { buildHomeViewModel } = loadCommonJs(path.join('miniprogram', 'view-models', 'home-view-model.js'), {
  '../utils/storage': storage
});
const { buildReviewViewModel } = loadCommonJs(path.join('miniprogram', 'view-models', 'review-view-model.js'), {
  '../utils/storage': storage
});
const { buildToolsViewModel } = loadCommonJs(path.join('miniprogram', 'view-models', 'tools-view-model.js'), {
  '../utils/storage': storage
});
const { buildProfileViewModel } = loadCommonJs(path.join('miniprogram', 'view-models', 'profile-view-model.js'), {
  '../utils/storage': storage
});

const homeWxml = read('miniprogram/pages/home/home.wxml');
const uploadJs = read('miniprogram/pages/upload/upload.js');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
assert(homeWxml.includes('bindtap="submitAiDraft"'), 'Home has a valid text-input submit action');
assert(homeWxml.includes('catchtap="planTonight"'), 'Home primary route action is wired');
assert(uploadJs.includes('saveFocusFromUploadText'), 'Upload can hand off a stuck point into todayFocus');
assert(entryDetailJs.includes('upload: {') && entryDetailJs.includes("primaryRoute: '/pages/upload/upload"), 'Entry detail hands former diagnosis intake into active upload flow');

storage.clearLearningData();
assert(buildHomeViewModel({}).emptyState, 'Home empty state guides first input');
assert(buildReviewViewModel({}).emptyState, 'Review empty state is safe without a focus');
assert(buildToolsViewModel({}).emptyState, 'Tools empty state is safe without a revisit card');
assert(buildProfileViewModel({}).emptyState, 'Profile empty state is safe without history');

const retiredPreference = storage.saveCompanionPreference('xiaoyuan');
assert.strictEqual(retiredPreference.selectedCompanion, 'gudian', 'retired companion ids normalize to the single mascot');
assert.strictEqual(retiredPreference.selectedLabel, '咕点', 'retired companion labels normalize to 咕点');

const focus = storage.saveTodayFocusFromThought('我卡在应用题列式关系，不知道第一步怎么写。', {
  source: 'rc6-core-loop-test'
});
assert(focus && focus.isStuck, 'Input can create a current stuck point');
assert.strictEqual(storage.loadTodayFocus().id, focus.id, 'Current stuck point persists locally');

const reviewVm = buildReviewViewModel({ todayFocus: focus, companionPreference: retiredPreference });
assert(reviewVm.primaryCard.sections.length >= 3, 'Review can render where/look/say first-step sections');
assert.strictEqual(reviewVm.primaryCta.action, 'review', 'Review starts the repair action for a new focus');

storage.updateTodayFocusRepair({ repairStatus: 'in_progress' });
const miniActionText = '我先圈出题目问什么，再找等量关系';
const miniDone = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText
});
assert.strictEqual(miniDone.hasMiniActionDone, true, 'Child first-step sentence is saved as local evidence');

const completed = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(completed.repairStatus, 'completed', 'Valid first-step evidence completes the repair');
const reviewCard = storage.loadReviewCards().find((card) => card.source === 'today_focus');
assert(reviewCard, 'Completed repair creates a light revisit card');
assert((reviewCard.front || reviewCard.question || '').includes(miniActionText), 'Review card keeps the child first-step wording');

const toolsVm = buildToolsViewModel({
  reviewCards: reviewCards.cardBrowser({ source: 'today_focus', status: 'all', limit: 3 }),
  companionPreference: retiredPreference
});
assert.strictEqual(toolsVm.primaryCard.hasReviewCard, true, 'Tools can surface the light revisit item');

const profileVm = buildProfileViewModel({
  todayFocus: storage.loadTodayFocus(),
  reviewCards: storage.loadReviewCards(),
  companionPreference: retiredPreference
});
const profileText = profileVm.primaryCard.sections.map((item) => item.text).join('\n');
assert(profileText.includes(miniActionText), 'Profile recap includes the child first-step sentence');
assert(!profileVm.emptyState, 'Profile has a parent recap after the core loop');

const visibleCoreText = [
  homeWxml,
  read('miniprogram/pages/upload/upload.wxml'),
  read('miniprogram/pages/entry-detail/entry-detail.wxml'),
  read('miniprogram/pages/review/review.wxml'),
  read('miniprogram/pages/profile/profile.wxml'),
  read('package.json')
].join('\n');
[
  '六个老师',
  '老师矩阵',
  '名师团队',
  '学科老师',
  '老师选择',
  '知识闯关',
  '学习雷达',
  '报告墙',
  '拍照出答案',
  '秒解',
  '答案已生成'
].forEach((term) => {
  assert(!visibleCoreText.includes(term), `Core visible copy avoids ${term}`);
});

console.log('All RC6 product core loop tests pass.');
