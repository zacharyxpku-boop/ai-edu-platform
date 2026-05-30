#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const storageMap = {};
global.wx = {
  getStorageSync(key) { return storageMap[key]; },
  setStorageSync(key, value) { storageMap[key] = value; },
  removeStorageSync(key) { delete storageMap[key]; }
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
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
    RegExp,
    JSON
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const homeVm = loadCommonJs(path.join('miniprogram', 'view-models', 'home-view-model.js'), {
  '../utils/storage': storage
});
const reviewVm = loadCommonJs(path.join('miniprogram', 'view-models', 'review-view-model.js'), {
  '../utils/storage': storage
});
const revisitVm = loadCommonJs(path.join('miniprogram', 'view-models', 'revisit-view-model.js'), {
  '../utils/storage': storage
});
const profileVm = loadCommonJs(path.join('miniprogram', 'view-models', 'profile-view-model.js'), {
  '../utils/storage': storage
});

const home = homeVm.buildHomeViewModel({});
assert(/今晚作业|今晚从哪一步开始/.test(home.title), 'home title is a real tonight-homework entry');
assert.strictEqual(home.teacherPickerLabel, '咕点在旁边', 'home mascot area anchors companionship');
assert.strictEqual(home.inputCard.title, '把今晚作业或卡住点发过来', 'home input card is homework/stuck-point oriented');
assert(home.inputCard.placeholder.includes('我写到第二步就乱了'), 'home placeholder uses a family scenario');
assert.strictEqual(home.primaryCta, '帮我安排今晚学习', 'home keeps main CTA');

const teacherCopy = storage.COMPANION_OPTIONS.map((item) => `${item.label}${item.short}`).join('\n');
['小原', '问问', '安安', '阿衡', '团团', '跃跃', '作业规划老师', '错题老师', '复习老师', '家长老师', '数学老师', '英语老师', '语文老师', '科学老师'].forEach((term) => {
  assert(!teacherCopy.includes(term), `mascot card does not show old teacher matrix: ${term}`);
});

const review = reviewVm.buildReviewViewModel({
  todayFocus: {
    id: 'focus_review_rc4',
    title: '写到第二步就乱了',
    issueType: '步骤断点',
    sourceText: '我写到第二步就乱了',
    repairStatus: 'in_progress'
  }
});
assert.strictEqual(review.title, '今晚只修一个卡点', 'review keeps one real stuck point');
assert(review.primaryCard.sections.some((item) => item.label === '今天卡在哪'), 'review shows where the child is stuck');
assert(review.primaryCard.sections.some((item) => item.label === '咕点建议你先看'), 'review shows where to look first');
assert(review.primaryCard.sections.some((item) => item.label === '你自己的第一步'), 'review asks the child to say the first step');
assert(review.miniAction.question.includes('我先'), 'miniAction is child-facing');
assert(review.miniAction.placeholder.includes('我先圈出题干条件'), 'miniAction placeholder is concrete');
assert(review.blackboard.intro.includes('不直接讲答案'), 'blackboard says it does not directly explain the answer');

const revisitWithCard = revisitVm.buildRevisitViewModel({
  reviewCard: {
    front: '你昨天说的第一步是：「我先找题目问什么」。今天还记得为什么先这样做吗？'
  }
});
assert.strictEqual(revisitWithCard.title, '今天只回看这一小步', 'revisit centers on recall');
assert.strictEqual(revisitWithCard.primaryCard.title, '回看昨天那一步', 'revisit card is a tomorrow-review card');
assert(revisitWithCard.primaryCard.body.includes('轻轻回看'), 'revisit card recalls the first step');
assert.strictEqual(revisitWithCard.primaryCta.text, '轻轻回看', 'revisit has recall CTA');

const revisitEmpty = revisitVm.buildRevisitViewModel({});
assert.strictEqual(revisitEmpty.primaryCard.title, '还没有可回访的第一步', 'revisit empty state is a review-card empty state');
assert.strictEqual(revisitEmpty.primaryCta.text, '先去说第一步', 'revisit empty state returns to real stuck-point repair');
assert(revisitEmpty.quickSections.some((item) => item.title === '明天轻轻回访'), 'revisit empty state stays in revisit framing');

const profile = profileVm.buildProfileViewModel({
  todayFocus: {
    id: 'focus_profile_rc4',
    title: '条件太多不知道怎么用',
    issueType: '读题审题',
    sourceText: '题目条件太多，我不知道怎么用',
    repairStatus: 'completed',
    miniActionText: '我先圈题目问什么',
    childArticulatedStep: '我先圈题目问什么',
    blackboardHint: { title: '审题小黑板', structure: '问题 → 条件 → 第一步' },
    blackboardUsedAt: '2026-05-13T00:00:00.000Z'
  },
  reviewCard: { front: '你昨天说的第一步是：「我先圈题目问什么」。今天还记得为什么先这样做吗？' }
});
assert(profile.title.includes('家长只问'), 'profile is framed as one parent question');
assert(profile.subtitle.includes('有没有说出第一步'), 'profile avoids report-style framing');
assert(profile.primaryCard.sections.some((item) => item.label === '他先迈出的第一步'), 'profile includes child first-step evidence');
assert(profile.primaryCard.sections.some((item) => item.label === '信任边界'), 'profile includes trust boundary evidence');
assert(profile.primaryCard.sections.some((item) => item.label === '家长只问一句'), 'profile includes one parent question');

const userVisibleText = collectStrings([home, review, revisitWithCard, revisitEmpty, profile]).join('\n');
[
  'todayFocus',
  'reviewCard',
  'issueType',
  'growth memory',
  'companionPreference',
  'blackboardHint',
  'miniActionText',
  '系统诊断',
  '家长应监督',
  '严重薄弱',
  '孩子问题',
  'proofScore',
  'benchmark',
  '秒解',
  '答案已生成',
  '拍照出答案',
  '数学老师',
  '英语老师',
  '小满'
].forEach((term) => {
  assert(!userVisibleText.includes(term), `viewModel user-visible text avoids system/product-manager term: ${term}`);
});

const firstScreenWxml = [
  read('miniprogram/pages/home/home.wxml'),
  read('miniprogram/pages/review/review.wxml'),
  read('miniprogram/pages/tutor/tutor.wxml'),
  read('miniprogram/pages/arcade/arcade.wxml'),
  read('miniprogram/pages/profile/profile.wxml')
].join('\n');
assert(!firstScreenWxml.includes('reviewViewModel.blackboard.intro'), 'review page no longer renders the dense blackboard intro on the first screen');
['yd-home-screen', 'yd-review-screen', 'yd-tutor-screen', 'yd-arcade-screen', 'yd-parent-screen'].forEach((shell) => {
  assert(firstScreenWxml.includes(shell), `new shell is present: ${shell}`);
});
[['show','Leg','acyEntryContent'].join(''), ['page','positioning'].join('-'), ['rc','14-'].join(''), ['v','1-topbar'].join(''), ['composer','shell'].join('-'), ['family','summary-card'].join('-'), 'proofScore', 'benchmark'].forEach((term) => {
  assert(!firstScreenWxml.includes(term), `first-screen WXML avoids report wording: ${term}`);
});

console.log('All RC4 user-centric copy tests pass.');
