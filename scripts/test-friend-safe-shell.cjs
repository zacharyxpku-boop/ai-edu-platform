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
  showModal(options = {}) {
    if (options.success) options.success({ confirm: true, content: '我想更清楚一点' });
  },
  navigateTo() {},
  switchTab() {},
  setClipboardData(options = {}) {
    if (options.success) options.success();
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
const focusCabin = loadCommonJs(path.join('miniprogram', 'utils', 'focus-cabin.js'), {
  './storage': storage
});

storage.clearLearningData();
storage.saveTodayFocusFromThought('应用题先圈条件', { taskType: 'math_word_problem', source: 'friend_safe_shell' });
storage.saveChildArticulatedStep('我先圈出题干条件');
focusCabin.resetSession({ durationId: '15' });
focusCabin.startSession({ durationId: '15' });
focusCabin.completeSession({ completedSeconds: 15 * 60 });

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const lightDiagnosisJs = read('miniprogram/pages/light-diagnosis/light-diagnosis.js');
const lightDiagnosisWxml = read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml');
const focusJs = read('miniprogram/pages/focus/focus.js');
const focusWxml = read('miniprogram/pages/focus/focus.wxml');
const reviewJs = read('miniprogram/pages/review/review.js');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const viewModels = [
  read('miniprogram/view-models/home-view-model.js'),
  read('miniprogram/view-models/profile-view-model.js'),
  read('miniprogram/view-models/review-view-model.js'),
  read('miniprogram/view-models/tools-view-model.js')
].join('\n');

assert(homeWxml.includes('friend-primary-grid'), 'Home renders the four primary scenario cards first');
['今晚作业没思路', '坐不住，想分心', '之前错题又卡了', '想练一小会'].forEach((label) => {
  assert(homeJs.includes(label), `Home shows scenario ${label}`);
});

assert(!profileWxml.includes('订阅') && !profileWxml.includes('解锁') && !profileWxml.includes('价格'), 'Profile hides mock subscription copy');
assert(profileWxml.includes('今晚卡住') && profileWxml.includes('只问一句') && profileWxml.includes('最近小结'), 'Profile first screen keeps only three main blocks');
assert(profileWxml.includes('再用两晚后，咕点会帮你看见模式'), 'Profile empty state stays honest');
assert(profileJs.includes('saveLocalFeedback'), 'Profile feedback is local instead of customer service chat');

assert(lightDiagnosisWxml.includes('手动选题型'), 'Light diagnosis is honest about manual confirmation');
assert(lightDiagnosisWxml.includes('不是自动识别答案'), 'Light diagnosis tells user it is not OCR');
assert(!lightDiagnosisJs.includes('拍照出答案') && !lightDiagnosisJs.includes('自动诊断'), 'Light diagnosis avoids fake-answer language');

assert(focusJs.includes('ambientAudio.onError') && focusJs.includes('doneAudio.onError'), 'Focus audio errors are handled');
assert(focusWxml.includes('休息一下再来') && focusWxml.includes('今天先到这儿'), 'Focus interruption offers low-pressure choices');
assert(focusCabin.pageState().selectedAudio.id === 'mute', 'Focus defaults to silent mode');

assert(reviewJs.includes('childArticulatedStep') && reviewJs.includes('todayFocus'), 'Review can read linked child-first-step evidence');
const history = focusCabin.loadHistory();
assert(history[0] && history[0].linkedChildArticulatedStep, 'Latest focus history stores child articulated step');

assert(arcadeJs.includes('loadTodayFocus') && arcadeJs.includes('taskType'), 'Arcade binds learning games to recent task type');
assert(arcadeJs.includes('learningBoundLine'), 'Arcade surfaces the recent-task binding line');

assert(viewModels.includes('今晚作业先从哪一步开始？') || viewModels.includes('今晚只修一个卡点'), 'View models keep family-facing anchors');

const forbidden = [];
[
  'miniprogram/pages/home/home.js',
  'miniprogram/pages/home/home.wxml',
  'miniprogram/pages/profile/profile.js',
  'miniprogram/pages/profile/profile.wxml',
  'miniprogram/pages/light-diagnosis/light-diagnosis.js',
  'miniprogram/pages/light-diagnosis/light-diagnosis.wxml',
  'miniprogram/pages/focus/focus.js',
  'miniprogram/pages/focus/focus.wxml',
  'miniprogram/view-models/home-view-model.js',
  'miniprogram/view-models/profile-view-model.js',
  'miniprogram/view-models/review-view-model.js',
  'miniprogram/view-models/tools-view-model.js'
].forEach((file) => {
  const text = read(file);
  ['系统', '自动诊断', '拍照识别', '订阅'].forEach((term) => {
    if (text.includes(term)) forbidden.push(`${file}:${term}`);
  });
});
assert.deepStrictEqual(forbidden, [], 'Friend-safe shell has no visible forbidden terms in pages/view-models');

console.log('All friend-safe shell tests pass.');
