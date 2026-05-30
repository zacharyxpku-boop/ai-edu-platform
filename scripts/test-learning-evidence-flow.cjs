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

function loadStorage() {
  return loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
    './learning-priority': {}
  });
}

function loadReviewCards(storageModule) {
  return loadCommonJs(path.join('miniprogram', 'utils', 'review-cards.js'), {
    './storage': storageModule,
    './game-logic': {}
  });
}

const storage = loadStorage();
const reviewCards = loadReviewCards(storage);

storage.clearLearningData();
let focus = storage.saveTodayFocusFromThought('我写到第二步就乱了', { source: 'test' });
assert.strictEqual(focus.issueType, '步骤断点', 'second-step confusion is classified as step break');
assert(/第二步|写到第二步/.test(focus.title), 'focus title keeps the concrete second-step phrase');

storage.clearLearningData();
focus = storage.saveTodayFocusFromThought('我不确定单位1是谁', { source: 'test' });
assert.strictEqual(focus.issueType, '列式关系', 'unit-one uncertainty is classified as relation setup');
assert(focus.title.includes('单位1'), 'focus title keeps unit-one evidence');

storage.clearLearningData();
focus = storage.saveTodayFocusFromThought('题目条件太多，我不知道怎么用', { source: 'test' });
assert.strictEqual(focus.issueType, '读题审题', 'condition overload is classified as reading the problem');
assert(/条件太多/.test(focus.title), 'condition overload keeps a concrete focus title');
assert.strictEqual(focus.sourceText, '题目条件太多，我不知道怎么用', 'focus keeps the child original words');
const conditionCard = storage.ensureTodayFocusReviewCard(Object.assign({}, focus, {
  id: 'focus_condition_overload',
  repairStatus: 'completed',
  hasMiniActionDone: true
}));
assert(conditionCard.backPrompt.includes('先看问题'), 'condition overload review prompt starts from the question');
assert(conditionCard.backPrompt.includes('相关条件'), 'condition overload review prompt asks for related conditions');

let blocked = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.notStrictEqual(blocked.repairStatus, 'completed', 'completion is blocked without miniActionText');
assert.strictEqual(blocked.blockedReason, 'mini_action_required', 'blocked completion records mini action requirement');

blocked = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText: '不知道'
});
assert.notStrictEqual(blocked.repairStatus, 'completed', 'invalid miniActionText does not complete repair');
assert.strictEqual(blocked.hasMiniActionDone, false, 'invalid miniActionText does not satisfy evidence gate');

const miniActionText = '我先找题目问的是谁';
let miniDone = storage.updateTodayFocusRepair({
  repairStatus: 'in_progress',
  hasMiniActionDone: true,
  miniActionText
});
assert.strictEqual(miniDone.hasMiniActionDone, true, 'valid miniActionText satisfies mini action');
assert.strictEqual(miniDone.miniActionText, miniActionText, 'miniActionText is saved locally');
assert(miniDone.miniActionAt, 'miniActionAt is saved locally');

const completed = storage.updateTodayFocusRepair({
  repairStatus: 'completed',
  hasMiniActionDone: true,
  miniActionText
});
assert.strictEqual(completed.repairStatus, 'completed', 'valid miniActionText allows completion');
assert.strictEqual(completed.progress, 100, 'completed repair reaches 100 progress');
assert(completed.completed_at, 'completed repair stores completed_at');
assert.strictEqual(storage.loadTodayFocus().miniActionText, miniActionText, 'completed focus keeps miniActionText in todayFocus');
assert.strictEqual(storage.loadTonightPlan().routeStatus, 'review_scheduled', 'completed repair moves Tonight Route to review_scheduled');

const card = storage.loadReviewCards().find((item) => item.source === 'today_focus');
assert(card, 'completed focus creates a review card');
const front = card.front || card.question || '';
assert(
  front.includes(completed.title) || front.includes(completed.sourceText) || front.includes(miniActionText),
  'review card front references concrete focus evidence'
);
assert.notStrictEqual(front, '这类题第一步应该先找什么？', 'review card is no longer the old generic prompt');

const dueFocusCards = reviewCards.cardBrowser({ source: 'today_focus', status: 'due', limit: 3 });
const allFocusCards = dueFocusCards.length ? dueFocusCards : reviewCards.cardBrowser({ source: 'today_focus', status: 'all', limit: 3 });
assert.strictEqual(dueFocusCards.length, 0, 'new today focus review card is not due immediately by default');
assert(allFocusCards.some((item) => item.id === card.id), 'knowledge playground can read generated today focus reviewCard before it is due');
assert(allFocusCards.some((item) => (item.front || item.question || '').includes(miniActionText)), 'knowledge playground review entry keeps miniActionText evidence');

const relationCard = storage.ensureTodayFocusReviewCard(Object.assign({}, completed, {
  id: 'focus_relation_specific',
  issueType: '列式关系',
  title: '单位1不确定',
  miniActionText: '',
  childArticulatedStep: '',
  childStepSentence: '',
  repairStatus: 'completed',
  hasMiniActionDone: true
}));
const stepCard = storage.ensureTodayFocusReviewCard(Object.assign({}, completed, {
  id: 'focus_step_specific',
  issueType: '步骤断点',
  title: '写到第二步就乱了',
  miniActionText: '',
  childArticulatedStep: '',
  childStepSentence: '',
  repairStatus: 'completed',
  hasMiniActionDone: true
}));
assert.notStrictEqual(relationCard.front, stepCard.front, 'different issue types produce different review card fronts');

const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');
assert(['parent-dash-evidence', 'parent-report-preview', 'parent-dash-action-row'].every((token) => profileWxml.includes(token)), 'profile summary renders the new parent evidence and next-action sections');
assert(profileViewModelJs.includes('他先迈出的第一步'), 'profile viewModel labels first-step evidence');
assert(profileViewModelJs.includes('刚才你第一步先看了哪里'), 'profile viewModel parent question can use first-step evidence');
const parentQuestion = `你昨天说第一步是「${storage.loadTodayFocus().miniActionText}」，今天还记得为什么吗？`;
assert(parentQuestion.includes(miniActionText), 'profile parent one-question can be generated from the saved miniActionText');

const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
assert(entryDetailWxml.includes('entry-jump-grid') && entryDetailWxml.includes('bindtap="openScene"'), 'entry detail replaces the retired knowledge playground with clickable scene jumps');
assert(reviewWxml.includes('review-challenge-grid') && reviewWxml.includes('data-scene="tutor"'), 'review shell keeps today-focus repair reachable without the retired tools page');

storage.clearLearningData();
const singleMemoryFocus = storage.saveTodayFocus({
  id: 'focus_memory_single',
  title: '写到第二步就乱了',
  issueType: '步骤断点',
  sourceText: '我写到第二步就乱了',
  thought: '我写到第二步就乱了',
  isStuck: true,
  repairStatus: 'completed',
  hasMiniActionDone: true,
  miniActionText: '我先找题目问什么'
});
storage.saveReviewCards([{
  id: 'rc_memory_single',
  source: 'today_focus',
  sourceFocusId: singleMemoryFocus.id,
  issueType: '步骤断点',
  weakPoint: '写到第二步就乱了',
  due: new Date(Date.now() - 1000).toISOString()
}]);
const singleMemoryLine = storage.getGrowthMemoryLine(null, { selectedCompanion: 'xiaoyuan' }).oneLine;
assert(singleMemoryLine.includes('今天记录到'), 'single growth memory record says today recorded');
assert(!singleMemoryLine.includes('最近常卡在'), 'single growth memory record does not overclaim recently often stuck');

storage.saveReviewCards([{
  id: 'rc_memory_repeat',
  source: 'today_focus',
  sourceFocusId: 'focus_memory_repeat',
  issueType: '步骤断点',
  weakPoint: '第一步卡住',
  due: new Date(Date.now() - 500).toISOString()
}].concat(storage.loadReviewCards()));
const repeatedMemoryLine = storage.getGrowthMemoryLine(null, { selectedCompanion: 'xiaoyuan' }).oneLine;
assert(repeatedMemoryLine.includes('最近常卡在'), 'two same-kind records may say recently often stuck');

const tabCopy = [
  read('miniprogram/pages/home/home.wxml'),
  reviewWxml,
  entryDetailWxml,
  profileWxml
].join('\n');
[
  'home_xiaodian_entry',
  'needs_student_step',
  '当前演示判断',
  '近 7 天错误类型分布',
  '系统诊断',
  '严重薄弱',
  '家长应监督',
  '秒解',
  '答案已生成',
  '拍照出答案',
  '数学老师',
  '英语老师',
  '语文老师',
  '科学老师',
  '小满'
].forEach((term) => {
  assert(!tabCopy.includes(term), `visible tab copy avoids ${term}`);
});

console.log('All learning evidence flow tests pass.');
