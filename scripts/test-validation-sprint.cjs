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
  },
  showToast() {},
  navigateTo() {},
  switchTab() {}
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
    Set,
    setTimeout(fn) {
      if (typeof fn === 'function') fn();
      return 1;
    },
    clearTimeout() {}
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const serviceAccess = loadCommonJs(path.join('miniprogram', 'utils', 'service-access.js'), {
  './storage': storage
});
const focusCabin = loadCommonJs(path.join('miniprogram', 'utils', 'focus-cabin.js'), {
  './storage': storage
});

storage.clearLearningData();

const dailyMathJs = read('miniprogram/pages/daily-math/daily-math.js');
const dailyMathWxml = read('miniprogram/pages/daily-math/daily-math.wxml');
assert(dailyMathJs.includes('mathToDiagnosisClick'), 'Daily math records mathToDiagnosisClick');
assert(dailyMathJs.includes('mathCompletionTime'), 'Daily math records mathCompletionTime');
assert(dailyMathJs.includes('今晚作业有卡住的题吗？'), 'Daily math transition prompt exists');
assert(dailyMathJs.includes('去看看'), 'Daily math accept option exists');
assert(dailyMathJs.includes('今晚很顺，不用啦'), 'Daily math reject option exists');

const dictationJs = read('miniprogram/pages/dictation/dictation.js');
const dictationWxml = read('miniprogram/pages/dictation/dictation.wxml');
assert(dictationJs.includes('dictationToDiagnosisClick'), 'Dictation records dictationToDiagnosisClick');
assert(dictationJs.includes('听写时你先看拼音还是字形'), 'Dictation transition prompt exists');

storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '不会', childStepQuality: 'vague' });
storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '不知道', childStepQuality: 'vague' });
storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '', childStepQuality: 'empty' });
const freeSummary = serviceAccess.buildWeeklySupportSummary(serviceAccess.loadServiceAccessState());
assert.strictEqual(freeSummary.mode, 'local_service_notice', 'Local service notice is honest about current scope');
assert(freeSummary.body.includes('模糊'), 'Local summary exposes vague count');
assert(freeSummary.body.includes('空白'), 'Local summary exposes empty count');
assert(freeSummary.actionSuggestion.includes('只问一句'), 'Local summary gives concrete parent action');
serviceAccess.configureServiceAccess('test');
const paidSummary = serviceAccess.buildWeeklySupportSummary(serviceAccess.loadServiceAccessState());
assert.strictEqual(paidSummary.mode, 'configured', 'Configured service shows progress mode');
assert(paidSummary.actionSuggestion.includes('今晚'), 'Configured summary gives tonight question');

const profileWxml = read('miniprogram/pages/profile/profile.wxml');
assert(profileWxml.includes('今晚卡住') && profileWxml.includes('只问一句') && profileWxml.includes('最近小结'), 'Profile first screen keeps friend-safe three-part recap');
assert(!profileWxml.includes('订阅') && !profileWxml.includes('解锁') && !profileWxml.includes('价格'), 'Profile friend-safe shell hides payment copy');
assert(!profileWxml.includes('完整历史数据与趋势'), 'Profile does not lead with feature list');

storage.saveTodayFocusFromThought('数学应用题圈了条件还是不会列式', { taskType: 'math_word_problem' });
storage.saveChildArticulatedStep('我先圈条件');
focusCabin.resetSession({ durationId: '15' });
focusCabin.startSession({ durationId: '15' });
focusCabin.completeSession({ completedSeconds: 15 * 60 });
const pause = focusCabin.parentPausePrompt(4);
assert(pause.phrase.includes('你刚才第一步看了什么'), 'Parent pause phrase exists');
storage.recordParentPostPauseBehavior('asked_one_question', { source: 'test' });
storage.recordParentPostPauseBehavior('direct_answer', { source: 'test' });
const focusJs = read('miniprogram/pages/focus/focus.js');
const focusWxml = read('miniprogram/pages/focus/focus.wxml');
assert(focusJs.includes('parentPauseSurvey'), 'Focus has post-pause survey state');
assert(focusJs.includes('setTimeout'), 'Focus schedules post-pause survey');
assert(focusJs.includes('你刚才给孩子提示了吗？'), 'Focus survey question exists');
assert(focusJs.includes('直接讲了答案'), 'Focus survey direct-answer option exists');
assert(focusJs.includes('只问了一句'), 'Focus survey phrase option exists');
assert(focusJs.includes('secondStepNotice') && focusWxml.includes('secondStepNotice'), 'Focus has second-step stuck notice');

storage.recordLightEntryCompletion('daily_math', { completionTime: new Date().toISOString() });
storage.recordLightToCoreTransition('daily_math', true, { feature: 'daily_math' });
storage.recordCoreLoopEntry('daily_math_transition', { feature: 'daily_math' });
storage.recordProfileVisit({ source: 'test' });
storage.recordServiceIntent('test');
const dashboard = storage.calculateValidationDashboard();
[
  'lightEntryDAU',
  'coreLoopEntryRate',
  'firstStepQualityTrend',
  'scaffoldingCompletionRate',
  'parentInterventionRate',
  'serviceIntentRate'
].forEach((key) => {
  assert(Object.prototype.hasOwnProperty.call(dashboard, key), `Dashboard calculates ${key}`);
});
assert(dashboard.coreLoopEntryRate >= 0, 'Core loop entry rate is numeric');
assert(Object.prototype.hasOwnProperty.call(dashboard.firstStepQualityTrend, 'vague'), 'Quality trend has vague count');
assert(Object.prototype.hasOwnProperty.call(dashboard.scaffoldingCompletionRate, 'completionRate'), 'Scaffolding conversion has completionRate');
assert(Object.prototype.hasOwnProperty.call(dashboard.parentInterventionRate, 'directAnswerRate'), 'Parent intervention has directAnswerRate');
assert(Object.prototype.hasOwnProperty.call(dashboard.serviceIntentRate, 'rate'), 'Service intent has rate');
assert(profileWxml.includes('isDevMode && isBetaTester'), 'Profile gates beta trial dashboard behind dev mode');

console.log('All validation sprint tests pass.');
