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
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
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
  return module.exports;
}

const gameLogic = loadCommonJs('miniprogram/utils/game-logic.js');
const storage = loadCommonJs('miniprogram/utils/storage.js', {
  './learning-priority': {},
  './game-logic': gameLogic
});
const tutorLadder = loadCommonJs('miniprogram/utils/tutor-ladder.js');

storage.clearLearningData();

storage.saveTodaySession({
  stuckPointText: '应用题列式卡住',
  taskType: 'math_word_problem',
  taskTypeConfirmed: true,
  tutorCompleted: true,
  childArticulatedStep: '我先圈条件和已知量',
  firstStepQuality: 'actionable',
  focusEvidence: {
    targetStep: '我先圈条件和已知量',
    duration: 900,
    completionType: 'completed',
    actualFocusSeconds: 900
  }
});
const card = storage.generateReviewCard(storage.getTodaySession());
assert.strictEqual(card.taskType, 'math_word_problem', 'review card keeps taskType');
assert(card.wrongCauseBucket, 'review card gets an organization bucket');
assert(card.repairPlan && card.repairPlan.includes('我先圈条件'), 'review card has concrete repair plan');

let queue = storage.loadSyncQueue();
assert(queue.some((item) => item.type === 'today_session'), 'todaySession writes a sync mutation');
assert(queue.some((item) => item.type === 'review_cards_snapshot'), 'review cards write a sync snapshot mutation');
assert(queue.some((item) => item.type === 'learning_state_snapshot'), 'review card generation queues a learning snapshot');

const snapshot = storage.queueLearningSyncSnapshot('production_hardening_test');
assert(snapshot.todaySession && snapshot.reviewCards && snapshot.gameProfile, 'learning snapshot contains loop state');

const backup = storage.createLocalBackup('before_manual_clear_test');
assert(backup.todaySession.childArticulatedStep, 'local backup contains the first step before clearing');
storage.clearLearningData();
const backupKey = `${storage.getLocalUserId()}:${storage.KEYS.localBackup}`;
assert(Array.isArray(storageMap[backupKey]) && storageMap[backupKey].length >= 1, 'clearLearningData preserves a local backup');

const rounds = tutorLadder.simulateThreeRoundSocratic([
  '直接告诉我答案',
  '我不会下一步怎么写',
  '我先圈条件和已知量'
], { selected: { text: '分数应用题' } });
assert.strictEqual(rounds.length, 3, 'three-round Socratic simulation returns three turns');
assert(rounds[0].directAnswerBlocked, 'direct answer request is blocked in round one');
assert(rounds.every((item) => item.noFinalAnswer), 'Socratic rounds do not leak a final answer');
assert(rounds.some((item) => item.asksForStudentStep), 'Socratic rounds keep asking for the student step');

const beforeGame = storage.loadGameProfile();
const gameResult = storage.recordGameSessionResult({
  gameType: 'whack',
  total: 4,
  correct: 4,
  accuracy: 100
});
assert(Number(gameResult.profile.streak || 0) >= Number(beforeGame.streak || 0), 'game completion updates retention streak');
assert((gameResult.profile.achievements || []).includes('first_review'), 'game completion can unlock a real achievement');

storage.saveTodaySession({
  date: '2026-05-13',
  childArticulatedStep: '第一晚先读题',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 300, completionType: 'completed' }
}, { now: '2026-05-13 20:00' });
storage.generateReviewCard(storage.getTodaySession({ now: '2026-05-13 20:00' }));
storage.saveTodaySession({
  date: '2026-05-14',
  childArticulatedStep: '第二晚先圈条件',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 420, completionType: 'completed' }
}, { now: '2026-05-14 20:00' });
storage.generateReviewCard(storage.getTodaySession({ now: '2026-05-14 20:00' }));
storage.saveTodaySession({
  childArticulatedStep: '第三晚先找等量关系',
  firstStepQuality: 'actionable',
  focusEvidence: { duration: 600, completionType: 'completed' }
});
const summary = storage.buildRecentLearningSummary();
assert(summary.threeNightText.includes('最近 3 晚'), 'profile summary is based on real 3-night records');
assert(summary.sevenNightText.includes('7 晚'), 'profile has an honest 7-night readiness line');

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const apiJs = read('miniprogram/utils/api.js');
const sessionApi = read('api/mini/session.js');
const tutorApi = read('api/mini/tutor-message.js');
assert(profileJs.includes('buildRecentLearningSummary'), 'profile page reads real 3/7-night summary');
assert(profileWxml.includes('threeNightSummary') && profileWxml.includes('sevenNightSummary'), 'profile page renders real summaries');
assert(arcadeJs.includes('recordGameSessionResult'), 'arcade completion records retention evidence');
assert(apiJs.includes('saveClientIdentity') && sessionApi.includes('openid_hash'), 'account/session path stores cloud identity when available');
assert(tutorApi.includes('sanitizeTutorReply'), 'tutor API sanitizes upstream model replies');
assert(tutorApi.includes('replyLooksLikeDirectAnswer'), 'tutor API detects direct-answer leakage');
assert(tutorApi.includes('output_sanitized'), 'tutor API reports when unsafe model output was sanitized');

console.log('All production hardening tests pass.');
