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
    JSON
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

const appJson = JSON.parse(read('miniprogram/app.json'));
assert(!appJson.pages.includes('pages/focus/focus'), 'Retired focus cabin page is not registered in the active miniapp shell');
assert(!appJson.tabBar.list.some((item) => item.pagePath === 'pages/focus/focus'), 'Focus cabin is not a crowded bottom tab');
assert(!read('miniprogram/utils/navigation.js').includes('RETIRED_ROUTE_MAP'), 'Retired focus routes are not kept as compatibility maps');

let state = focusCabin.pageState();
assert(state.currentSession, 'Focus cabin has safe first-load session state');
assert.strictEqual(state.focusTarget.source, 'empty', 'No first-step empty state is explicit');
assert.strictEqual(state.settings.selectedAudioId, 'mute', 'Focus defaults to silent mode');
assert.strictEqual(state.scenes.length, 3, 'Focus shows three built-in cabin wallpapers');
assert.strictEqual(state.audioModes.length, 4, 'Focus shows four ambient sound options');
assert(state.scenes.some((item) => item.id === 'night_desk'), 'Focus includes night desk experience scene');
assert(state.scenes.some((item) => item.id === 'morning_window'), 'Focus includes morning window experience scene');
assert(state.scenes.some((item) => item.id === 'quiet_forest'), 'Focus includes quiet forest experience scene');
assert(state.scenes.every((item) => item.asset && item.asset.includes('/assets/focus/')), 'Focus scenes point to local wallpaper assets');
assert(state.audioModes.some((item) => item.id === 'mute'), 'Focus includes quiet mode');
assert(state.audioModes.some((item) => item.id === 'rain'), 'Focus includes rain ambient mode');
assert(state.audioModes.some((item) => item.id === 'cafe'), 'Focus includes cafe ambient mode');
assert(state.audioModes.some((item) => item.id === 'campfire'), 'Focus includes campfire ambient mode');
assert(state.audioModes.filter((item) => item.id !== 'mute').every((item) => item.asset && item.asset.includes('/assets/focus/')), 'Focus audio modes point to local audio assets');
assert(state.durationModes.some((item) => item.minutes === 15), '15 minute mode exists');
assert(state.durationModes.some((item) => item.minutes === 60), '60 minute mode exists');
assert(state.breakModes.some((item) => item.id === 'short_break'), 'Short break mode exists');

focusCabin.setManualTask('先圈出题干条件');
state = focusCabin.pageState();
assert.strictEqual(state.focusTarget.source, 'manual', 'Manual task fallback binds focus target');
assert(state.focusTarget.title.includes('先圈出题干条件'), 'Manual task title is visible');

focusCabin.selectScene('morning_window');
focusCabin.selectAudio('rain');
focusCabin.setVolume(55);
state = focusCabin.pageState();
assert.strictEqual(state.selectedScene.id, 'morning_window', 'Scene switching persists');
assert.strictEqual(state.selectedAudio.id, 'rain', 'Audio switching persists');
assert.strictEqual(state.settings.volume, 55, 'Volume state persists');

let session = focusCabin.startSession({ durationId: '15' });
assert.strictEqual(session.status, 'running', 'Session can start');
assert.strictEqual(session.durationMinutes, 15, 'Timer uses selected duration');
session = focusCabin.pauseSession();
assert.strictEqual(session.status, 'paused', 'Session can pause');
session = focusCabin.resumeSession();
assert.strictEqual(session.status, 'running', 'Session can resume');
session = focusCabin.interruptSession('need_water');
assert.strictEqual(session.status, 'interrupted', 'Session can interrupt safely');
assert(session.mascotLine.includes('也算开始'), 'Interrupted state keeps low-pressure mascot copy');
assert.strictEqual(session.completionType, 'interrupted', 'Interrupted session is stored as effort evidence');

session = focusCabin.resetSession({ durationId: 'short_break' });
assert.strictEqual(session.mode, 'break', 'Short break mode can initialize a break session');

const completed = focusCabin.completeSession({ completedSeconds: 15 * 60 });
assert.strictEqual(completed.status, 'completed', 'Session can complete');
assert(completed.childLine, 'Completion stores child-facing encouragement');
assert(completed.parentRecap, 'Completion stores parent recap');
assert.strictEqual(focusCabin.loadHistory().length, 2, 'Completion and interruption persist to local history');
const focusReviewCard = storage.ensureFocusReviewCard(completed);
assert(focusReviewCard && focusReviewCard.type === 'focus_cabin_return', 'Focus completion creates a next-day review card');
assert(focusReviewCard.releaseGate === 'focus_first_step_recalled_before_second_step', 'Focus review card gates second step on first-step recall');
assert(focusReviewCard.blockedFields.includes('score') && focusReviewCard.blockedFields.includes('ranking'), 'Focus review card blocks score and ranking');

let summary = focusCabin.progressSummary();
assert.strictEqual(summary.totalSessions, 2, 'Progress tracks focus sessions');
assert(summary.totalFocusMinutes >= 15, 'Progress tracks focus minutes');
assert.strictEqual(summary.tonightCompletionCount, 2, 'Progress tracks tonight completion count');
assert(summary.badges.length >= 1, 'Growth layer creates lightweight milestones');

storage.saveTodayFocusFromThought('我卡在列方程关系，不知道第一步怎么写。', { source: 'focus_test' });
state = focusCabin.pageState();
assert.strictEqual(state.focusTarget.source, 'today_focus', 'Focus cabin binds current first-step when available');

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
[
  ['miniprogram/assets/focus/night-desk.png', 300 * 1024],
  ['miniprogram/assets/focus/morning-window.png', 300 * 1024],
  ['miniprogram/assets/focus/quiet-forest.png', 300 * 1024],
  ['miniprogram/assets/focus/rain.mp3', 500 * 1024],
  ['miniprogram/assets/focus/cafe.mp3', 500 * 1024],
  ['miniprogram/assets/focus/campfire.mp3', 500 * 1024],
  ['miniprogram/assets/focus/ding.mp3', 80 * 1024]
].forEach(([file, maxBytes]) => {
  const full = path.join(root, file);
  assert(fs.existsSync(full), `${file} exists`);
  assert(fs.statSync(full).size > 1000, `${file} is not empty`);
  assert(fs.statSync(full).size < maxBytes, `${file} stays small enough for local package`);
});
assert(!fs.existsSync(path.join(root, 'miniprogram/pages/focus')), 'retired focus page directory has been physically removed');
assert(profileJs.includes('focus-cabin'), 'Profile imports focus cabin summary');
assert(!profileWxml.includes('focusCabinSummary'), 'Profile no longer renders the retired focus cabin recap panel');
assert(entryDetailJs.includes('const SCENES') && entryDetailWxml.includes('entry-jump-grid'), 'Entry detail replaces focus UI with child scene routes');
assert(tutorWxml.includes('yd-tutor-screen') && reviewWxml.includes('yd-review-screen'), 'Focus work is now handled by tutor and review active shells');

const visibleText = [entryDetailWxml, tutorWxml, reviewWxml, profileWxml].join('\n');
[
  '六个老师',
  '老师矩阵',
  '名师团队',
  '学科老师',
  '闯关',
  '报告墙',
  '快测',
  '雷达',
  '弱点',
  '带学面板',
  '拍照出答案',
  '秒解',
  '答案已生成'
].forEach((term) => {
  assert(!visibleText.includes(term), `Focus cabin visible copy avoids ${term}`);
});
console.log('All focus cabin tests pass.');
