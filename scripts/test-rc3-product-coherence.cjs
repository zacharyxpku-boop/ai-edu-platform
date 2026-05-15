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

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const homeVm = loadCommonJs(path.join('miniprogram', 'view-models', 'home-view-model.js'), {
  '../utils/storage': storage
});
const reviewVm = loadCommonJs(path.join('miniprogram', 'view-models', 'review-view-model.js'), {
  '../utils/storage': storage
});
const toolsVm = loadCommonJs(path.join('miniprogram', 'view-models', 'tools-view-model.js'), {
  '../utils/storage': storage
});
const profileVm = loadCommonJs(path.join('miniprogram', 'view-models', 'profile-view-model.js'), {
  '../utils/storage': storage
});

const homeWxml = read('miniprogram/pages/home/home.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const firstScreenSource = [
  read('miniprogram/view-models/home-view-model.js'),
  read('miniprogram/view-models/review-view-model.js'),
  read('miniprogram/view-models/tools-view-model.js'),
  read('miniprogram/view-models/profile-view-model.js'),
  homeWxml,
  reviewWxml,
  toolsWxml,
  profileWxml
].join('\n');

const home = homeVm.buildHomeViewModel({
  companionPreference: { selectedCompanion: 'xiaoyuan', selectedLabel: '小原' }
});
assert.strictEqual(home.title, '今晚作业先从哪一步开始？', 'home keeps the route-start question');
assert.strictEqual(home.primaryCta, '帮我安排今晚学习', 'home keeps the main CTA');
assert.strictEqual(home.teacherPickerLabel, '咕点在旁边', 'home keeps mascot cue');
assert.strictEqual(home.teacherPickerHint, '我懂你卡住了，我陪你先迈出第一步。', 'mascot cue explains companionship promise');
assert(homeWxml.includes('homeViewModel.primaryCta'), 'home first screen CTA is bound through viewModel');
assert(!homeWxml.includes('companion-picker'), 'home removes the teacher selector');

assert.strictEqual(storage.COMPANION_OPTIONS.length, 1, 'home keeps one mascot');
assert(storage.COMPANION_OPTIONS.some((item) => item.label === '咕点' && item.short === '先动一小步'), '咕点 keeps first-step short copy');
const teacherCardCopy = storage.COMPANION_OPTIONS.map((item) => `${item.label}${item.short}`).join('\n');
['小原', '问问', '安安', '阿衡', '团团', '跃跃', '作业规划老师', '错题老师', '复习老师', '家长老师', '数学老师', '英语老师'].forEach((term) => {
  assert(!teacherCardCopy.includes(term), `mascot card avoids teacher-matrix label: ${term}`);
});

const reviewNoFocus = reviewVm.buildReviewViewModel({});
assert.strictEqual(reviewNoFocus.title, '今晚只修一个卡点', 'review keeps one repair question');
assert.strictEqual(reviewNoFocus.blackboard, null, 'blackboard is absent without todayFocus');

const reviewNotStarted = reviewVm.buildReviewViewModel({
  todayFocus: { id: 'focus_not_started', issueType: '步骤断点', repairStatus: 'not_started' }
});
assert.strictEqual(reviewNotStarted.blackboard, null, 'blackboard is absent before repair state');

const reviewInProgress = reviewVm.buildReviewViewModel({
  todayFocus: { id: 'focus_in_progress', issueType: '步骤断点', repairStatus: 'in_progress' }
});
assert(reviewInProgress.blackboard, 'blackboard appears during repair state for supported issueType');
assert.strictEqual(reviewInProgress.blackboard.title, '步骤小黑板', 'step-break blackboard title stays templated');
assert.strictEqual(reviewInProgress.blackboard.structure, '第一步 → 下一步 → 检查', 'step-break blackboard only shows structure');
assert(reviewInProgress.blackboard.intro.includes('不直接讲答案'), 'blackboard intro makes the non-answer boundary explicit');
assert(!/答案|秒解|拍照出答案|答案已生成|完整解法|讲完整题/.test(`${reviewInProgress.blackboard.title}${reviewInProgress.blackboard.body}${reviewInProgress.blackboard.structure}`), 'blackboard templates avoid answer-tool and full-solution wording');

const unsupportedReview = reviewVm.buildReviewViewModel({
  todayFocus: { id: 'focus_unsupported', issueType: '计算粗心', repairStatus: 'in_progress' }
});
assert.strictEqual(unsupportedReview.blackboard, null, 'unsupported issueType does not force a blackboard');

const tools = toolsVm.buildToolsViewModel({});
assert.strictEqual(tools.title, '今天只回看这一小步', 'tools keeps active recall as the main question');
const profile = profileVm.buildProfileViewModel({
  todayFocus: {
    id: 'focus_profile_blackboard',
    issueType: '读题审题',
    title: '条件太多不知道怎么用',
    sourceText: '题目条件太多，我不知道怎么用',
    repairStatus: 'completed',
    miniActionText: '我先圈题目问什么',
    childArticulatedStep: '我先圈题目问什么',
    blackboardHint: { title: '审题小黑板', structure: '问题 → 条件 → 第一步' },
    blackboardUsedAt: '2026-05-13T00:00:00.000Z'
  }
});
assert(profile.primaryCard.sections.some((item) => item.label === '他先迈出的第一步' && item.text.includes('我先圈题目问什么')), 'profile reads child first-step evidence');
assert(profile.primaryCard.sections.some((item) => item.label === '专注证据'), 'profile reads focus evidence lightly');
assert(profile.primaryCard.sections.some((item) => item.label === '家长只问一句' && item.text.includes('刚才你第一步先看了哪里')), 'profile parent question stays around first-step evidence');

[
  '千问小讲堂',
  '千问讲题',
  '拍题讲解',
  '拍照出答案',
  '讲完整题',
  '完整解法',
  '今日老师接手',
  '6 位老师怎么分工',
  '当前演示判断',
  '近 7 天错误类型分布',
  '小满',
  '秒解',
  '答案已生成',
  '数学老师',
  '英语老师',
  '语文老师',
  '科学老师'
].forEach((term) => {
  assert(!firstScreenSource.includes(term), `first-screen product copy avoids forbidden path wording: ${term}`);
});

assert(read('package.json').includes('test-rc3-product-coherence.cjs'), 'npm test includes RC3.3 product coherence test');

console.log('All RC3 product coherence tests pass.');
