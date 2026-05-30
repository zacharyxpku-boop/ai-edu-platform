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
  getStorageSync(key) { return storageMap[key]; },
  setStorageSync(key, value) { storageMap[key] = value; },
  removeStorageSync(key) { delete storageMap[key]; },
  showToast() {},
  navigateTo() {},
  switchTab() {},
  createCanvasContext() {
    return {
      setFillStyle() {},
      fillRect() {},
      setFontSize() {},
      fillText() {},
      measureText(text) { return { width: String(text || '').length * 24 }; },
      draw(_reserve, callback) { if (callback) callback(); }
    };
  },
  canvasToTempFilePath(options) { if (options && options.success) options.success({ tempFilePath: '/tmp/weekly-summary.png' }); },
  saveImageToPhotosAlbum(options) { if (options && options.success) options.success(); }
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
    App(config) { capturedApp = config; },
    Date,
    Math,
    String,
    Number,
    Object,
    Array,
    RegExp,
    JSON,
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
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

const activeDirs = fs.readdirSync(path.join(root, 'miniprogram/pages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepStrictEqual(activeDirs, ['arcade', 'entry-detail', 'home', 'legal', 'profile', 'review', 'tutor', 'upload'], 'only active miniapp pages remain');

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const tutorJs = read('miniprogram/pages/tutor/tutor.js');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');

assert(homeWxml.includes('mini-entry-grid') && homeWxml.includes('mini-route-card'), 'Home surfaces the primary entries first');
assert(homeJs.includes('openEntryDetail') && !/\/pages\/(?:daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//.test(homeJs), 'Home routes retired entries through the active child shell');
assert(entryDetailJs.includes('const SCENES') && entryDetailWxml.includes('entry-jump-grid'), 'Entry detail owns child-scene routing');
assert(entryDetailJs.includes("primaryRoute: '/pages/tutor/tutor") && entryDetailJs.includes("primaryRoute: '/pages/review/review"), 'Child scenes route to tutor and review');
assert(tutorWxml.includes('tutor-hero-shell') && tutorJs.includes('openEntryDetail'), 'Tutor handles first-step work and active child-scene entry');
assert(reviewWxml.includes('review-hero-shell') && reviewWxml.includes('review-challenge-grid'), 'Review handles recall and transfer');
assert(profileJs.includes('profileEmptyGuide') && profileWxml.includes('parent-hero-shell'), 'Profile empty state and parent shell are present');
assert(profileJs.includes('buildParentReport') && profileJs.includes('buildWeeklyGrowthMemory'), 'Profile builds parent report and weekly memory from real evidence');
assert(profileWxml.includes('parent-report-preview') && profileWxml.includes('parent-dash-route'), 'Profile first screen keeps report preview and next route modules');

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
storage.remove(serviceAccess.KEY);
serviceAccess.saveServiceAccessState({ installDate: isoDaysAgo(0), configured: false });
assert(!serviceAccess.canAccess('deep_scaffolding').allowed, 'Unconfigured deep service stays blocked without fake trial');
serviceAccess.saveServiceAccessState({ installDate: isoDaysAgo(7), configured: false });
assert(!serviceAccess.canAccess('deep_scaffolding').allowed, 'Unconfigured deep service remains blocked honestly');

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

const activeCopy = [homeWxml, entryDetailWxml, tutorWxml, reviewWxml, profileWxml].join('\n');
['秒解', '拍照出答案', '答案已生成', '排名', 'PK'].forEach((term) => {
  assert(!activeCopy.includes(term), `active copy avoids unsafe wording: ${term}`);
});

console.log('All loop closure tests pass.');
