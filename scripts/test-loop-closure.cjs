#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const storageMap = {};
let capturedApp = null;

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
  switchTab() {},
  createCanvasContext() {
    return {
      setFillStyle() {},
      fillRect() {},
      setFontSize() {},
      fillText() {},
      measureText(text) {
        return { width: String(text || '').length * 24 };
      },
      draw(_reserve, callback) {
        if (callback) callback();
      }
    };
  },
  canvasToTempFilePath(options) {
    if (options && options.success) options.success({ tempFilePath: '/tmp/weekly-summary.png' });
  },
  saveImageToPhotosAlbum(options) {
    if (options && options.success) options.success();
  }
};

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}, extras = {}) {
  const full = path.join(root, filePath);
  const sandbox = Object.assign({
    module: { exports: {} },
    exports: {},
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    wx: global.wx,
    App(config) {
      capturedApp = config;
    },
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
  }, extras);
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {}
});
const serviceAccess = loadCommonJs(path.join('miniprogram', 'utils', 'service-access.js'), {
  './storage': storage
});

storage.remove(serviceAccess.KEY);
storage.clearLearningData();

loadCommonJs(path.join('miniprogram', 'app.js'), {
  './utils/api': { initSession: () => Promise.resolve({}) },
  './utils/storage': storage
});
assert(capturedApp && typeof capturedApp.onLaunch === 'function', 'app.js registers App onLaunch');
capturedApp.onLaunch();
const localUserId = storage.getLocalUserId();
assert(/^user_\d+_\d{4}$/.test(localUserId), 'app launch initializes localUserId with user_ prefix');
assert.strictEqual(storage.getUserKey(storage.KEYS.profile), `${localUserId}:${storage.KEYS.profile}`, 'storage prefixes user data keys');

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
assert(profileJs.includes('profileEmptyGuide'), 'Profile computes empty guide');
assert(profileWxml.includes('再用两晚，咕点会帮你看见孩子常卡在哪一步') || profileJs.includes('再用两晚，咕点会帮你看见孩子常卡在哪一步'), 'Profile empty state uses warm guide');
assert(!profileWxml.includes('假曲线') && !profileWxml.includes('0% 占位'), 'Profile empty state does not expose fake placeholder copy');

const lightDiagnosisJs = read('miniprogram/pages/light-diagnosis/light-diagnosis.js');
const lightDiagnosisWxml = read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml');
assert(lightDiagnosisWxml.includes('这道题是什么科目？'), 'Light diagnosis asks subject before suggestion');
assert(lightDiagnosisWxml.includes('你现在卡在哪一步？'), 'Light diagnosis asks stuck step before suggestion');
assert(lightDiagnosisWxml.includes('这道题我不太确定类型'), 'Light diagnosis has honest uncertainty copy');
assert(lightDiagnosisJs.includes('subject') && lightDiagnosisJs.includes('stuckStep'), 'Light diagnosis uses manual subject and stuck step');

const focusJs = read('miniprogram/pages/focus/focus.js');
const dictationJs = read('miniprogram/pages/dictation/dictation.js');
assert(focusJs.includes('ambientAudio.onError') && focusJs.includes('doneAudio.onError'), 'Focus audio objects register onError');
assert(focusJs.includes('../../assets/focus/rain.mp3'), 'Focus uses relative rain audio path');
assert(dictationJs.includes('wordAudio.onError'), 'Dictation audio registers onError');
assert(dictationJs.includes('../../assets/focus/ding.mp3'), 'Dictation uses relative local audio path');

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
storage.remove(serviceAccess.KEY);
serviceAccess.saveServiceAccessState({ installDate: isoDaysAgo(0), configured: false });
assert(!serviceAccess.canAccess('deep_scaffolding').allowed, 'Unconfigured deep service stays blocked without fake trial');
serviceAccess.saveServiceAccessState({ installDate: isoDaysAgo(6), configured: false });
assert(!serviceAccess.canAccess('deep_scaffolding').allowed, 'Unconfigured deep service stays blocked after multiple days');
serviceAccess.saveServiceAccessState({ installDate: isoDaysAgo(7), configured: false });
assert(!serviceAccess.canAccess('deep_scaffolding').allowed, 'Unconfigured deep service remains blocked honestly');

assert(profileJs.includes('generateWeeklySummaryImage'), 'Profile can generate weekly summary canvas image');
assert(profileWxml.includes('weeklySummaryCanvas'), 'Profile WXML contains weekly summary canvas');
assert(profileJs.includes('原点私教本周小结') && profileJs.includes('本周') && profileJs.includes('确认第一步'), 'Profile canvas includes weekly summary and badge text');
assert(profileWxml.includes('今晚卡住') && profileWxml.includes('只问一句') && profileWxml.includes('最近小结'), 'Profile first screen keeps only three modules');
assert(profileWxml.includes('再用两晚后，咕点会帮你看见模式'), 'Profile empty state uses warm guide');
assert(!profileWxml.includes('订阅') && !profileWxml.includes('解锁') && !profileWxml.includes('价格') && !profileWxml.includes('本地演示'), 'Profile hides payment copy in friend-safe shell');

const miniFiles = [];
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git'].includes(entry.name)) walk(full);
    } else if (/\.(js|wxml)$/.test(entry.name)) {
      miniFiles.push(full);
    }
  });
}
walk(path.join(root, 'miniprogram'));
const forbiddenBrand = [];
miniFiles.forEach((file) => {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, 'utf8').replace(/AI EDU/g, '');
  ['系统', 'AI 助手', '机器人'].forEach((term) => {
    if (text.includes(term)) forbiddenBrand.push(`${rel}: ${term}`);
  });
});
assert.deepStrictEqual(forbiddenBrand, [], 'Visible brand language avoids cold system/AI/robot wording');

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
assert(homeJs.includes('showFirstRunOverlay') && homeWxml.includes('咕点不直接给答案') && homeWxml.includes('陪你先看清今晚第一步'), 'Home has first-run guide overlay');
assert(homeJs.includes('今晚作业没思路') && homeJs.includes('坐不住，想分心') && homeJs.includes('之前错题又卡了') && homeJs.includes('想练一小会'), 'Home shows four scenario entries');
assert(homeWxml.includes('friend-primary-grid'), 'Home surfaces the four primary entries first');
assert(homeJs.includes('markFirstRunGuideSeen'), 'Home can hide first-run guide after first visit');
assert(homeJs.includes('onShareAppMessage') && focusJs.includes('onShareAppMessage') && profileJs.includes('onShareAppMessage') && read('miniprogram/pages/daily-math/daily-math.js').includes('onShareAppMessage'), 'Core pages implement share handlers');

[
  'light_entry_completed',
  'core_loop_entered',
  'first_step_confirmed',
  'focus_started',
  'focus_completed',
  'profile_viewed',
  'service_intent_clicked'
].forEach((node) => storage.recordLocalAnalytics(node, { source: 'loop_closure_test' }));
const analytics = storage.localAnalyticsDashboard();
assert(analytics.nodes.filter((item) => item.count > 0).length >= 6, 'localAnalytics records at least six funnel nodes');
assert(profileJs.includes('localAnalyticsDashboard'), 'Profile computes developer funnel for beta accounts');

console.log('All loop closure tests pass.');
