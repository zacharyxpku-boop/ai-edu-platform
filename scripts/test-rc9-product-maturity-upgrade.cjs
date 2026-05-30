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
    RegExp,
    JSON,
    Set
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const focusCabin = loadCommonJs(path.join('miniprogram', 'utils', 'focus-cabin.js'), {
  './storage': storage
});
const reviewViewModels = loadCommonJs(path.join('miniprogram', 'view-models', 'review-view-model.js'), {
  '../utils/storage': storage
});
const revisitViewModels = loadCommonJs(path.join('miniprogram', 'view-models', 'revisit-view-model.js'), {
  '../utils/storage': storage
});
const profileViewModels = loadCommonJs(path.join('miniprogram', 'view-models', 'profile-view-model.js'), {
  '../utils/storage': storage
});

storage.clearLearningData();

let focus = storage.saveTodayFocusFromThought('数学应用题读题时不知道先圈哪些条件', {
  source: 'rc9_test'
});

assert(focus.systemSuggestedStep, 'System suggestion is stored');
assert.strictEqual(focus.childArticulatedStep, '', 'Child articulated step starts separate from system suggestion');
assert.strictEqual(focus.firstStepStatus, 'suggested', 'First step starts as suggested');
assert.strictEqual(focus.firstStepSource, 'system_suggested', 'Initial source is system suggestion');

assert.strictEqual(storage.childStepQuality('   '), 'empty', 'Empty child step is detected');
assert.strictEqual(storage.childStepQuality('不会'), 'vague', 'Vague child step is detected');
assert.strictEqual(storage.childStepQuality('题干条件'), 'partial', 'Partial direction is detected');
assert.strictEqual(storage.childStepQuality('我先圈出题干条件'), 'actionable', 'Concrete action is detected');

assert.strictEqual(storage.detectTaskType('应用题题干条件很多'), 'math_word_problem', 'Math word problem detection works');
assert.strictEqual(storage.detectTaskType('不知道怎么列方程找等量关系'), 'equation_setup', 'Equation setup detection works');
assert.strictEqual(storage.detectTaskType('英语句子主语谓语找不到'), 'english_sentence', 'English sentence detection works');

Object.keys({
  math_word_problem: true,
  equation_setup: true,
  reading_question: true,
  english_sentence: true,
  writing_process: true,
  unknown: true
}).forEach((taskType) => {
  storage.firstStepTemplatesForTaskType(taskType).forEach((template) => {
    assert(!/答案|结果|等于|所以答案|完整解法/.test(template), `Template avoids full answer: ${taskType}`);
  });
});

let reviewVm = reviewViewModels.buildReviewViewModel({ todayFocus: focus });
assert(reviewVm.primaryCard.sections.some((section) => section.label === '咕点建议你先看'), 'Review exposes system suggestion');
assert(reviewVm.primaryCard.sections.some((section) => section.label === '你自己的第一步'), 'Review exposes child first step');
assert(reviewVm.miniAction, 'Review asks for child confirmation when missing');
assert(reviewVm.miniAction.question.includes('我先'), 'Review prompt is low pressure');

focus = storage.saveChildArticulatedStep('我先圈出题干条件', {
  repairStatus: 'in_progress',
  progress: 78
});
assert.strictEqual(focus.systemSuggestedStep !== focus.childArticulatedStep, true, 'System suggestion and child step remain separate');
assert.strictEqual(focus.childArticulatedStep, '我先圈出题干条件', 'Quick choice persists child articulated step');
assert.strictEqual(focus.childStepQuality, 'actionable', 'Persisted child step quality is actionable');
assert.strictEqual(focus.firstStepStatus, 'child_confirmed', 'Child confirmation updates status');

let target = focusCabin.resolveFocusTarget();
assert.strictEqual(target.targetSource, 'child_articulated', 'Focus target prefers child articulated step');
assert.strictEqual(target.title, '我先圈出题干条件', 'Focus title uses child step');

storage.saveTodayFocus(Object.assign({}, focus, {
  childArticulatedStep: '',
  childStepSentence: '',
  hasMiniActionDone: false,
  firstStepSource: 'system_suggested',
  firstStepStatus: 'suggested'
}));
target = focusCabin.resolveFocusTarget();
assert.strictEqual(target.targetSource, 'system_suggested', 'Focus target falls back to system suggestion');

storage.remove(storage.KEYS.todayFocus);
focusCabin.setManualTask('我先读第一句话');
target = focusCabin.resolveFocusTarget('我先读第一句话');
assert.strictEqual(target.targetSource, 'manual', 'Focus target falls back to manual task');

focus = storage.saveTodayFocusFromThought('方程题不知道等量关系在哪里', { source: 'rc9_test_2' });
focus = storage.saveChildArticulatedStep('我先找等量关系', { repairStatus: 'in_progress' });
let session = focusCabin.startSession({ durationId: '15' });
assert.strictEqual(session.focusTarget.targetSource, 'child_articulated', 'Started session binds child step');
let completed = focusCabin.completeSession({ completedSeconds: 15 * 60 });
assert.strictEqual(completed.completionType, 'completed', 'Completed session stores completion type');
assert.strictEqual(completed.taskBound, true, 'Completed session stores taskBound evidence');
assert(completed.focusEvidenceText.includes('这一小步'), 'Completion evidence is first-step bound');
assert(completed.parentRecapLine.includes('这一步'), 'Completion parent recap is first-step bound');
assert(completed.childEncouragementLine.includes('真的开始过'), 'Completion encouragement avoids timer-only copy');

focusCabin.resetSession({ durationId: '15' });
session = focusCabin.startSession({ durationId: '15' });
focusCabin.tickSession(120);
const interrupted = focusCabin.interruptSession('need_pause');
assert.strictEqual(interrupted.completionType, 'interrupted', 'Interrupted session is recorded');
assert(interrupted.actualFocusSeconds >= 120, 'Interrupted session stores actual focus seconds');
assert(interrupted.gentleInterruptionRecap.includes('接着来'), 'Interrupted session has gentle recap');
assert.notStrictEqual(interrupted.status, 'failed', 'Interrupted session is not failure');

const revisitCompleted = revisitViewModels.buildRevisitViewModel({ latestFocusSession: completed });
assert(revisitCompleted.primaryCard.body.includes('已经坐过一段'), 'Tools builds revisit from completed evidence');
assert(revisitCompleted.primaryCard.questions.includes('昨天你第一步先看了哪里？'), 'Tools asks light revisit question');
const revisitInterrupted = revisitViewModels.buildRevisitViewModel({ latestFocusSession: interrupted });
assert(revisitInterrupted.primaryCard.body.includes('停在这里'), 'Tools builds revisit from interrupted evidence');

const profileVm = profileViewModels.buildProfileViewModel({
  todayFocus: storage.loadTodayFocus(),
  latestFocusSession: interrupted,
  focusHistory: focusCabin.loadHistory(),
  reviewEvents: storage.loadReviewEvents()
});
assert(profileVm.parentRecap.parentOneQuestion.includes('刚才你第一步先看了哪里'), 'Profile includes parent one question');
assert(profileVm.parentRecap.trustBoundaryNote.includes('没有直接给结果'), 'Profile includes trust boundary');
assert(profileVm.primaryCard.sections[0].id === 'tonightRecap', 'Profile prioritizes tonight recap first');

const proofOne = focusCabin.proofSummary([], null);
assert(proofOne.oneNightProof.includes('再用几晚后'), '1-night proof does not fake data when empty');
assert(proofOne.threeNightPattern.includes('再用几晚后'), '3-night proof does not fake data when insufficient');
assert(proofOne.sevenNightReadiness.includes('再用几晚后'), '7-night proof does not fake data when insufficient');

const visibleText = [
  read('miniprogram/pages/home/home.wxml'),
  read('miniprogram/pages/upload/upload.wxml'),
  read('miniprogram/pages/entry-detail/entry-detail.wxml'),
  read('miniprogram/pages/review/review.wxml'),
  read('miniprogram/pages/profile/profile.wxml'),
  read('miniprogram/view-models/review-view-model.js'),
  read('miniprogram/view-models/revisit-view-model.js'),
  read('miniprogram/view-models/profile-view-model.js')
].join('\n');

[
  '提分',
  '保证提升成绩',
  '掌握知识点',
  '自动诊断薄弱点',
  '拍照出答案',
  '秒解',
  '答案已生成',
  '替代老师',
  '替代家长',
  '排名',
  'PK',
  '冲榜',
  '必须打卡',
  '付费',
  '服务方案',
  '报告墙',
  '弱点'
].forEach((term) => {
  assert(!visibleText.includes(term), `Visible copy avoids forbidden claim: ${term}`);
});

console.log('All RC9 product maturity upgrade tests pass.');
