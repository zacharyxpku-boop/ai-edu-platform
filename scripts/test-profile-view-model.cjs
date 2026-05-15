#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadModule(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

const storageStub = {
  buildCompanionPreference() {
    return { selectedCompanion: 'gudian', selectedLabel: '咕点' };
  }
};

const vmPath = path.join('miniprogram', 'view-models', 'profile-view-model.js');
assert(fs.existsSync(path.join(root, vmPath)), 'profile-view-model.js exists');
const profileVm = loadModule(vmPath, { '../utils/storage': storageStub });
assert.strictEqual(typeof profileVm.buildProfileViewModel, 'function', 'buildProfileViewModel is exported');

const vmWithEvidence = profileVm.buildProfileViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  todayFocus: {
    title: '写到第二步就乱了',
    issueType: '步骤断点',
    sourceText: '我写到第二步就乱了',
    systemSuggestedStep: '先看题目问的是什么。',
    childArticulatedStep: '我先圈出题干条件',
    repairStatus: 'completed'
  },
  latestFocusSession: {
    id: 'focus_session_1',
    completionType: 'completed',
    taskBound: true,
    linkedChildArticulatedStep: '我先圈出题干条件',
    focusTarget: { title: '我先圈出题干条件' }
  },
  focusHistory: [
    { taskBound: true, linkedChildArticulatedStep: '我先圈出题干条件', completionType: 'completed' }
  ],
  reviewEvents: [{ type: 'today_focus_review_card_created' }],
  recentLearningSummary: {
    latest3: [
      { date: '2026-05-15', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-14', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 0 },
      { date: '2026-05-13', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 }
    ],
    latest7: [
      { date: '2026-05-15', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-14', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 0 },
      { date: '2026-05-13', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-12', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 0 },
      { date: '2026-05-11', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 1 },
      { date: '2026-05-10', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 0 },
      { date: '2026-05-09', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 }
    ],
    firstStepDays: 5,
    focusDays: 7,
    gameDays: 4
  }
});

assert.strictEqual(vmWithEvidence.routePill, '今晚路线 · 第 5 步：家长 5 秒复盘', 'viewModel outputs routePill');
assert(vmWithEvidence.companionStrip.includes('咕点'), 'viewModel outputs mascot strip');
assert(vmWithEvidence.title.includes('家长只问这一句'), 'viewModel title contains parent one-question framing');
assert(vmWithEvidence.subtitle.includes('说出第一步'), 'viewModel outputs first-step subtitle');
assert.strictEqual(vmWithEvidence.primaryCta, '完成今日复盘', 'viewModel outputs primary CTA');
assert(vmWithEvidence.parentRecap.tonightRecap.includes('今晚孩子卡在'), 'parent recap includes tonight recap');
assert(vmWithEvidence.parentRecap.parentOneQuestion.includes('刚才你第一步先看了哪里'), 'parent recap includes one question');
assert(vmWithEvidence.parentRecap.trustBoundaryNote.includes('没有给答案'), 'parent recap includes no-answer trust boundary');
assert.strictEqual(vmWithEvidence.primaryCard.sections[0].id, 'tonightRecap', 'primary card prioritizes tonight recap');
assert(vmWithEvidence.primaryCard.sections.some((item) => item.id === 'trustBoundary'), 'primary card includes trust boundary');
assert(vmWithEvidence.nextStep.includes('今晚看见了'), 'one-night proof is visible without fake trends');
assert(vmWithEvidence.parentRecap.threeNightPattern.includes('最近 3 晚'), 'profile recap uses real 3-night local summary');
assert(vmWithEvidence.parentRecap.sevenNightReadiness.includes('最近 7 晚'), 'profile recap uses real 7-night local summary');
assert.strictEqual(vmWithEvidence.growthMemoryCard.localEvidenceDays, 7, 'growth memory exposes local evidence day count');

const vmWithoutChildStep = profileVm.buildProfileViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  todayFocus: {
    title: '单位1不确定',
    issueType: '列式关系',
    systemSuggestedStep: '先找等量关系'
  },
  focusHistory: []
});
assert(vmWithoutChildStep.parentRecap.trustBoundaryNote.includes('整理一个可开始的第一步'), 'missing child step keeps safe boundary');
assert(vmWithoutChildStep.parentRecap.threeNightPattern.includes('再用几晚后'), '3-night pattern does not fake data');
assert(vmWithoutChildStep.parentRecap.sevenNightReadiness.includes('再用几晚后'), '7-night readiness does not fake data');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const unsafeText = collectStrings([vmWithEvidence, vmWithoutChildStep]).join('\n');
[
  /系统诊断/,
  /家长应盯着/,
  /孩子问题/,
  /报告墙/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/,
  /保证提升成绩/
].forEach((pattern) => {
  assert(!pattern.test(unsafeText), `profileViewModel avoids unsafe visible text: ${pattern}`);
});

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
assert(profileJs.includes('profile-view-model'), 'profile page imports profile viewModel');
assert(profileJs.includes('latestFocusSession'), 'profile page passes latest focus evidence');
assert(profileJs.includes('focusHistory'), 'profile page passes focus history');

const firstScreen = profileWxml.slice(
  profileWxml.indexOf('rc14-profile-first-screen'),
  profileWxml.indexOf('rc14-profile-after-first-screen')
);
assert(firstScreen.includes('profileViewModel.routePill'), 'first screen reads routePill from profileViewModel');
assert(firstScreen.includes('今晚卡住') && firstScreen.includes('只问一句') && firstScreen.includes('最近小结'), 'first screen renders friend-safe recap sections');

console.log('All profile view model tests pass.');
