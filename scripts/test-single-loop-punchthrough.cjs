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
  switchTab() {},
  navigateTo() {}
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
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const storage = loadCommonJs('miniprogram/utils/storage.js', {
  './learning-priority': {}
});
const focusCabin = loadCommonJs('miniprogram/utils/focus-cabin.js', {
  './storage': storage
});

storage.clearLearningData();

const sessionA = storage.getTodaySession();
const sessionB = storage.getTodaySession();
assert.strictEqual(sessionA.createdAt, sessionB.createdAt, 'getTodaySession keeps one active session per day');
assert.strictEqual(sessionA.date, sessionB.date, 'getTodaySession returns the same dated session');

storage.saveTodaySession({ childArticulatedStep: '', firstStepQuality: 'empty' });
assert.strictEqual(storage.canStartFocusFromTodaySession(storage.getTodaySession()), false, 'empty first step blocks focus');
const focusJs = read('miniprogram/pages/focus/focus.js');
assert(focusJs.includes('先回咕点确认今晚第一步，才能进专注舱'), 'focus page shows first-step blocking toast');

storage.saveTodayFocusFromThought('数学应用题不会列式，先找条件', { taskType: 'math_word_problem', source: 'tutor' });
storage.saveChildArticulatedStep('我先圈条件和已知量', { tutorCompleted: true });
let session = storage.getTodaySession();
assert.strictEqual(session.tutorCompleted, true, 'tutor completion writes back to todaySession');
assert.notStrictEqual(session.firstStepQuality, 'empty', 'tutor writes a non-empty first-step quality');

focusCabin.resetSession({ durationId: '15' });
const focused = focusCabin.startSession({ durationId: '15' });
assert.strictEqual(focused.focusTarget.title, session.childArticulatedStep, 'focus target strictly binds todaySession childArticulatedStep');

const beforeCards = storage.loadReviewCards().length;
focusCabin.completeSession({ completedSeconds: 15 * 60 });
session = storage.getTodaySession();
assert(Number(session.focusEvidence.duration) > 0, 'focus writes duration into todaySession');
assert.strictEqual(session.reviewCardGenerated, true, 'focus completion triggers review card generation');
const afterCards = storage.loadReviewCards();
assert.strictEqual(afterCards.length, beforeCards + 1, 'reviewCards length increments after focus completion');
assert(afterCards[0].childArticulatedStep.includes('圈条件'), 'review card keeps childArticulatedStep');
assert(afterCards[0].focusCompletionType, 'review card keeps focusCompletionType');

storage.saveTodaySession({
  taskType: 'math_word_problem',
  childArticulatedStep: '我先圈条件和已知量',
  firstStepQuality: 'actionable',
  gamePlayed: false
});
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
assert(arcadeJs.includes('storage.getTodaySession') && arcadeJs.includes('gamePlayed'), 'arcade reads todaySession and checks gamePlayed');
session = storage.getTodaySession();
assert.strictEqual(session.taskType, 'math_word_problem', 'todaySession taskType is available for arcade binding');
storage.saveTodaySession({
  gamePlayed: true,
  gameEvidence: {
    taskType: session.taskType,
    firstStep: session.childArticulatedStep,
    score: 80,
    completed: true
  }
});
assert.strictEqual(storage.getTodaySession().gamePlayed, true, 'game replay is blocked by todaySession.gamePlayed');

const profileJs = read('miniprogram/pages/profile/profile.js');
const parentQuestion = storage.parentQuestionFromFirstStep('我先圈条件和已知量');
assert(parentQuestion.includes('圈') && profileJs.includes('parentQuestionFromFirstStep'), 'profile parent question is generated from the concrete first-step keyword');

storage.clearLearningData();
storage.saveTodaySession({
  date: '2026-05-14',
  status: 'active',
  stuckPointText: '应用题列式卡住',
  taskType: 'math_word_problem',
  tutorCompleted: true,
  childArticulatedStep: '圈条件',
  firstStepQuality: 'actionable',
  firstStepSource: 'child_articulated',
  focusBound: true,
  focusEvidence: {
    targetStep: '圈条件',
    targetSource: 'child_articulated',
    duration: 300,
    completionType: 'interrupted',
    interruptedAt: '2026-05-14T23:00:00.000Z',
    actualFocusSeconds: 300
  }
}, { now: '2026-05-14 23:00' });
const archived = storage.archiveYesterdaySession({ now: '2026-05-15 14:00' });
assert(archived && archived.session.status === 'abandoned', 'archiveYesterdaySession marks interrupted yesterday session abandoned');
assert.strictEqual(storage.loadReviewCards()[0].date, '2026-05-14', 'archive creates yesterday review card at the top');
const yesterday = storage.getYesterdayReview('2026-05-15 14:00');
assert(yesterday && yesterday.childArticulatedStep === '圈条件', 'home can read yesterday review card with the child step');
const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
assert(homeJs.includes('昨晚我们停在') && homeWxml.includes('yesterdayReviewCard'), 'home renders a cross-day light revisit card');
assert.strictEqual(storage.isYesterday('2026-05-14 23:00', '2026-05-15 14:00'), true, 'isYesterday handles the 22:00+ cross-day boundary');

const appJs = read('miniprogram/app.js');
assert(appJs.includes('archiveYesterdaySession'), 'app launch archives yesterday session');

console.log('All single-loop punchthrough tests pass.');
