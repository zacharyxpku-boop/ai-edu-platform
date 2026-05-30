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
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const reviewVm = loadCommonJs(path.join('miniprogram', 'view-models', 'review-view-model.js'), {
  '../utils/storage': storage
});
const profileVm = loadCommonJs(path.join('miniprogram', 'view-models', 'profile-view-model.js'), {
  '../utils/storage': storage
});

const homeWxml = read('miniprogram/pages/home/home.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const packageJson = JSON.parse(read('package.json'));

assert(homeWxml.includes('homeViewModel.teacherPickerLabel'), 'home shows mascot cue title from viewModel');
assert(homeWxml.includes('homeViewModel.teacherPickerHint'), 'home shows lightweight mascot hint from viewModel');
assert(!homeWxml.includes('wx:for="{{companionOptions}}"'), 'home no longer renders companion options');
assert(!homeWxml.includes('{{item.short}}') && !homeWxml.includes('{{item.desc}}'), 'home no longer renders teacher cards');

const optionCopy = storage.COMPANION_OPTIONS.map((item) => `${item.label}${item.short}`).join('\n');
['小原', '问问', '安安', '阿衡', '团团', '跃跃'].forEach((name) => {
  assert(!optionCopy.includes(name), `mascot option removes old teacher name: ${name}`);
});
[
  '理顺一点',
  '多问一步',
  '慢一点',
  '记得我',
  '讲给家长',
  '闯一小关'
].forEach((copy) => {
  assert(!optionCopy.includes(copy), `mascot option removes old companion style: ${copy}`);
});
assert(optionCopy.includes('咕点') && optionCopy.includes('先动一小步'), 'mascot option keeps 咕点 and the first-step role');

const allVisibleSources = [
  homeWxml,
  reviewWxml,
  read('miniprogram/view-models/review-view-model.js'),
  read('miniprogram/view-models/profile-view-model.js')
].join('\n');
[
  /老师分工/,
  /作业规划老师/,
  /错题老师/,
  /复习老师/,
  /家长老师/,
  /数学老师/,
  /英语老师/,
  /语文老师/,
  /科学老师/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/
].forEach((pattern) => {
  assert(!pattern.test(allVisibleSources), `RC3 visible copy avoids forbidden wording: ${pattern}`);
});

storage.clearLearningData();
const unsupported = storage.saveTodayFocus({
  id: 'focus_blackboard_unsupported',
  title: '计算乱了',
  issueType: '计算粗心',
  sourceText: '我老算错',
  isStuck: true,
  repairStatus: 'in_progress'
});
assert.strictEqual(storage.buildBlackboardHint(unsupported), null, 'blackboard does not show for unsupported issue type');

[
  ['列式关系', '关系小黑板', '整体 → 部分 → 关系'],
  ['读题审题', '审题小黑板', '问题 → 条件 → 第一步'],
  ['步骤断点', '步骤小黑板', '第一步 → 下一步 → 检查'],
  ['概念公式', '概念小黑板', '概念 → 条件 → 公式']
].forEach(([issueType, title, structure]) => {
  const hint = storage.buildBlackboardHint({
    id: `focus_${issueType}`,
    issueType,
    title: `${issueType}卡点`,
    sourceText: `${issueType}卡住了`
  });
  assert(hint, `${issueType} creates blackboard hint`);
  assert.strictEqual(hint.title, title, `${issueType} title matches`);
  assert.strictEqual(hint.structure, structure, `${issueType} structure matches`);
  assert(!/答案|秒解|拍照出答案|答案已生成/.test(`${hint.title}${hint.body}${hint.structure}`), `${issueType} blackboard avoids answer-tool wording`);
});

const noFocusVm = reviewVm.buildReviewViewModel({});
assert.strictEqual(noFocusVm.blackboard, null, 'blackboard is absent without todayFocus');

const notStartedVm = reviewVm.buildReviewViewModel({
  todayFocus: { id: 'focus_not_started', issueType: '步骤断点', repairStatus: 'not_started' }
});
assert.strictEqual(notStartedVm.blackboard, null, 'blackboard is absent before repair starts');

const inProgressVm = reviewVm.buildReviewViewModel({
  todayFocus: { id: 'focus_in_progress', issueType: '读题审题', repairStatus: 'in_progress' }
});
assert(inProgressVm.blackboard && inProgressVm.blackboard.title === '审题小黑板', 'blackboard appears during repair state');
assert(inProgressVm.blackboard.layers && inProgressVm.blackboard.layers.length === 3, 'blackboard exposes three visible first-step layers');
assert(inProgressVm.blackboard.stopRuleLine && inProgressVm.blackboard.stopRuleLine.includes('第一步'), 'blackboard exposes a stop rule for first-step teaching');
assert(reviewWxml.includes('reviewViewModel.blackboard'), 'review page renders blackboard from viewModel');
assert(reviewWxml.includes('reviewViewModel.blackboard.layers'), 'review page renders visual blackboard layers from viewModel');

storage.clearLearningData();
let relationFocus = storage.saveTodayFocusFromThought('我不确定单位1是谁', { source: 'rc31_real_device_flow' });
assert.strictEqual(relationFocus.issueType, '列式关系', 'unit-one flow creates relation issue type');
assert(relationFocus.title.includes('单位1'), 'unit-one flow keeps concrete title evidence');
const relationHint = storage.buildBlackboardHint(relationFocus);
assert(relationHint && relationHint.title === '关系小黑板', 'unit-one flow creates relation blackboard');
relationFocus = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  progress: 60,
  blackboardHint: Object.assign({}, relationHint, { usedAt: '2026-05-13T01:00:00.000Z' }),
  blackboardUsedAt: '2026-05-13T01:00:00.000Z'
});
assert(relationFocus.blackboardHint && relationFocus.blackboardHint.structure === '整体 → 部分 → 关系', 'blackboardHint is saved on repair start');
assert(relationFocus.blackboardUsedAt, 'blackboardUsedAt is saved on repair start');
relationFocus = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText: '我先找谁是整体'
});
relationFocus = storage.updateTodayFocusRepair({
  repairStatus: 'completed',
  hasMiniActionDone: true,
  miniActionText: '我先找谁是整体'
});
assert.strictEqual(relationFocus.repairStatus, 'completed', 'unit-one blackboard flow completes repair');
assert.strictEqual(relationFocus.miniActionText, '我先找谁是整体', 'unit-one blackboard flow keeps miniActionText');
assert(relationFocus.blackboardHint && relationFocus.blackboardUsedAt, 'completed unit-one focus keeps blackboard evidence');
const relationReviewCard = storage.loadReviewCards().find((item) => item.sourceFocusId === relationFocus.id && item.source === 'today_focus')
  || storage.loadReviewCards().find((item) => item.sourceFocusId === relationFocus.id);
assert(relationReviewCard, 'unit-one blackboard flow creates reviewCard');
assert(
  (relationReviewCard.front || '').includes('我先找谁是整体') || (relationReviewCard.front || '').includes('单位1'),
  'unit-one reviewCard references concrete focus or miniActionText'
);
assert((relationReviewCard.front || '').includes('整体 → 部分 → 关系'), 'unit-one reviewCard references blackboard structure');
const relationProfile = profileVm.buildProfileViewModel({
  todayFocus: relationFocus,
  reviewCard: relationReviewCard
});
assert(relationProfile.primaryCard.sections.some((item) => item.label === '他先迈出的第一步' && item.text.includes('我先找谁是整体')), 'profile reads unit-one child first-step evidence');
assert(relationProfile.primaryCard.sections.some((item) => item.label === '信任边界' && item.text.includes('没有给答案')), 'profile keeps unit-one trust boundary');
assert(relationProfile.primaryCard.sections.some((item) => item.label === '家长只问一句' && item.text.includes('刚才你第一步先看了哪里')), 'profile parent question stays around first-step evidence');

storage.clearLearningData();
let focus = storage.saveTodayFocus({
  id: 'focus_blackboard_review_card',
  title: '条件太多不知道怎么用',
  issueType: '读题审题',
  sourceText: '题目条件太多，我不知道怎么用',
  isStuck: true,
  repairStatus: 'not_started'
});
const hint = storage.buildBlackboardHint(focus);
focus = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  progress: 60,
  blackboardHint: Object.assign({}, hint, { usedAt: '2026-05-13T00:00:00.000Z' }),
  blackboardUsedAt: '2026-05-13T00:00:00.000Z'
});
focus = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText: '我先圈题目问什么'
});
focus = storage.updateTodayFocusRepair({
  repairStatus: 'completed',
  hasMiniActionDone: true,
  miniActionText: '我先圈题目问什么'
});
const card = storage.loadReviewCards().find((item) => item.sourceFocusId === focus.id && item.source === 'today_focus')
  || storage.loadReviewCards().find((item) => item.sourceFocusId === focus.id);
assert(card, 'completed blackboard repair creates reviewCard');
assert((card.front || '').includes('昨天小黑板提醒你先看：问题 → 条件 → 第一步。'), 'reviewCard references blackboard structure');
assert(card.blackboardHint && card.blackboardHint.structure === '问题 → 条件 → 第一步', 'reviewCard stores blackboard hint');

const profile = profileVm.buildProfileViewModel({
  todayFocus: focus,
  reviewCard: card
});
assert(profile.primaryCard.sections.some((item) => item.label === '信任边界' && item.text.includes('没有给答案')), 'profileViewModel keeps no-answer evidence lightly');

assert(packageJson.scripts.test.includes('test-rc3-teacher-blackboard.cjs'), 'npm test includes RC3 teacher blackboard test');

console.log('All RC3 teacher and blackboard tests pass.');
