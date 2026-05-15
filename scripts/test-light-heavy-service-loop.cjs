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
    Set
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
const lightFeatures = loadCommonJs(path.join('miniprogram', 'utils', 'light-features.js'), {
  './storage': storage
});
const focusCabin = loadCommonJs(path.join('miniprogram', 'utils', 'focus-cabin.js'), {
  './storage': storage
});

storage.clearLearningData();

const mathScaffold = storage.deepScaffoldingTemplates('math_word_problem');
assert.strictEqual(mathScaffold.length, 3, 'Math scaffolding reaches third step');
assert(mathScaffold[0].includes('已知条件'), 'Math scaffold starts from conditions');
assert(mathScaffold[1].includes('关系'), 'Math scaffold second step links conditions');
assert(mathScaffold[2].includes('式子'), 'Math scaffold third step reaches setup');
assert(storage.deepScaffoldingTemplates('reading_question')[2].includes('相关'), 'Reading scaffold has third step');
assert(storage.buildSecondStepHint('equation_setup', '我先设 x').secondStep.includes('相等关系'), 'Second-step hint is scaffold, not answer');
assert(!/答案|秒解|保证/.test(storage.buildSecondStepHint('math_word_problem').secondStep), 'Second-step hint avoids answer claims');

const math = lightFeatures.buildDailyMath('2026-05-14');
assert.strictEqual(math.items.length, 10, 'Daily math creates 10 items');
assert.strictEqual(math.durationMinutes, 3, 'Daily math is a 3-minute light feature');
assert(math.items[0].firstStepCheck.includes('先看清'), 'Daily math feedback is first-step based');
assert.strictEqual(new Set(math.items.map((item) => item.prompt)).size, 10, 'Daily math avoids repeated items in one session');
assert(lightFeatures.buildDailyMath('2026-05-14', { grade: '二年级' }).items.every((item) => /^[\d\s+-]+$/.test(item.prompt)), 'Lower grade math uses simple addition/subtraction');
assert(lightFeatures.buildDailyMath('2026-05-14', { grade: '四年级' }).items.some((item) => /×|÷/.test(item.prompt)), 'Middle grade math uses multiplication/division');
assert(lightFeatures.buildDailyMath('2026-05-14', { grade: '六年级' }).items.some((item) => /\/|\./.test(item.prompt)), 'Upper grade math uses fraction/decimal items');
const mathResult = lightFeatures.submitDailyMath(Array(10).fill('0'), math);
assert(mathResult.feedback.includes('先回看这一步'), 'Daily math does not become pure answer checking');
assert.strictEqual(mathResult.shareCard.showScore, false, 'Share card hides score');
assert.strictEqual(mathResult.shareCard.showRank, false, 'Share card hides ranking');

const dictation = lightFeatures.submitDictation('春天 田野', '我先看字形');
assert(dictation.firstStepPrompt.includes('先看了拼音还是字形'), 'Dictation asks first-step question');
assert.strictEqual(dictation.event.source, 'dictation', 'Dictation writes shared first-step event');

const diagnosis = lightFeatures.confirmLightDiagnosis('应用题不知道怎么圈条件', '我先圈出题干条件');
assert.strictEqual(diagnosis.requiresManualConfirmation, true, 'Light diagnosis is manual-confirmation first');
assert(diagnosis.suggestedFirstStep.includes('先'), 'Light diagnosis returns suggested first step');
assert(!/答案|秒解/.test(diagnosis.suggestedFirstStep), 'Light diagnosis does not output answer');
const englishDiagnosis = lightFeatures.buildLightDiagnosis('英语句子看不懂', { subject: 'english', stuckStep: 'other' });
assert(englishDiagnosis.suggestedFirstStep.includes('主语和谓语'), 'English light diagnosis uses subject-appropriate first step');
assert(!englishDiagnosis.suggestedFirstStep.includes('未知数'), 'English light diagnosis does not leak math template');
const formulaDiagnosis = lightFeatures.buildLightDiagnosis('数学应用题', { subject: 'math', stuckStep: 'formula' });
assert(formulaDiagnosis.suggestedFirstStep.includes('题目问什么'), 'Formula stuck state gets question-first scaffold');

const profile = storage.loadUserFirstStepProfile();
assert(profile.events.length >= 3, 'Light feature events flow into shared first-step profile');
const pattern = storage.loadTaskTypePattern();
assert(pattern.byTaskType.daily_math, 'Task type pattern stores daily math');
assert(pattern.byTaskType.dictation, 'Task type pattern stores dictation');
assert(pattern.byTaskType.math_word_problem || pattern.byTaskType.light_diagnosis, 'Task type pattern stores detected diagnosis type');

storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '不会', childStepQuality: 'vague' });
storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '不知道', childStepQuality: 'vague' });
storage.recordFirstStepEvent({ taskType: 'reading_question', childArticulatedStep: '看题', childStepQuality: 'vague' });
const intervention = storage.detectAvoidancePattern(storage.loadTaskTypePattern());
assert.strictEqual(intervention.triggered, true, 'Three vague first steps trigger light intervention');
assert(intervention.prompt.includes('3 分钟'), 'Avoidance intervention is light');

const focus = storage.saveTodayFocusFromThought('数学应用题圈了条件还是不会列式', { taskType: 'math_word_problem' });
storage.saveChildArticulatedStep('我先圈出题干条件');
focusCabin.resetSession({ durationId: '15' });
focusCabin.startSession({ durationId: '15' });
const completed = focusCabin.completeSession({ completedSeconds: 15 * 60 });
assert.strictEqual(completed.completionType, 'completed', 'Focus completed session still works');
const chains = storage.loadScaffoldingChains();
assert(chains.length >= 1, 'Completed focus creates scaffolding chain');
assert(chains[0].secondStepSuggestion.includes('关系'), 'Scaffolding chain contains second-step hint');

const pause = focusCabin.parentPausePrompt(4);
assert(pause.phrase.includes('你刚才第一步看了什么'), 'Parent pause suggests product phrase');
const parentLogs = storage.loadParentInterventionLog();
assert(parentLogs[0].usedProductPhrase, 'Parent intervention log stores phrase usage');
assert.strictEqual(parentLogs[0].gaveDirectAnswer, false, 'Parent intervention log avoids direct-answer behavior');

let access = serviceAccess.canAccess('deep_scaffolding');
assert.strictEqual(access.allowed, false, 'Deep scaffolding is blocked until service configuration is available');
serviceAccess.saveServiceAccessState({
  configured: false,
  installDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
});
access = serviceAccess.canAccess('deep_scaffolding');
assert.strictEqual(access.allowed, false, 'Unconfigured service stays gated without fake trial countdown');
assert(access.gate.body.includes('本地记录'), 'Service gate explains current local scope');
assert(access.gate.actionSuggestion.includes('只问一句'), 'Service gate gives action suggestion');
serviceAccess.requestServiceAccess('test');
serviceAccess.configureServiceAccess('test');
access = serviceAccess.canAccess('deep_scaffolding');
assert.strictEqual(access.allowed, true, 'Configured service unlocks deep scaffolding');

const guide = storage.buildParentActionGuide();
assert(guide.monthSuggestion.includes('每晚只问这一句'), 'Profile parent guide gives one actionable sentence');
assert(guide.parentPhraseTraining.title.includes('21 天'), 'Parent training camp entry exists');
const checklist = storage.buildExperienceChecklist();
assert(checklist.some((item) => item.field === 'light_feature_daily_active'), 'Experience checklist defines light DAU field');
assert(checklist.some((item) => item.field === 'parent_phrase_used'), 'Trial checklist defines parent phrase usage field');
assert(checklist.some((item) => item.field === 'child_second_step_status'), 'Trial checklist defines second-step status field');

const appJson = JSON.parse(read('miniprogram/app.json'));
['pages/daily-math/daily-math', 'pages/dictation/dictation', 'pages/light-diagnosis/light-diagnosis'].forEach((page) => {
  assert(appJson.pages.includes(page), `${page} is registered`);
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    assert(fs.existsSync(path.join(root, 'miniprogram', `${page}.${ext}`)), `${page}.${ext} exists`);
  });
});

const visible = [
  read('miniprogram/pages/daily-math/daily-math.wxml'),
  read('miniprogram/pages/dictation/dictation.wxml'),
  read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml'),
  read('miniprogram/pages/home/home.wxml'),
  read('miniprogram/pages/focus/focus.wxml'),
  read('miniprogram/pages/profile/profile.wxml')
].join('\n');

['PK', '冲榜', '排名', '提分', '秒解答案', '答案已生成', '必须打卡'].forEach((term) => {
  assert(!visible.includes(term), `Visible light/heavy copy avoids ${term}`);
});
assert(visible.includes('每日轻口算'), 'Home exposes daily math entry');
assert(visible.includes('听写小助手'), 'Home exposes dictation entry');
assert(visible.includes('手动选题型'), 'Home exposes honest manual task-type entry');
assert(visible.includes('这道题是什么科目？'), 'Light diagnosis asks subject before suggestion');
assert(visible.includes('你现在卡在哪一步？'), 'Light diagnosis asks stuck step before suggestion');
assert(visible.includes('不是自动识别答案'), 'Light diagnosis does not pretend to OCR');
assert(visible.includes('好，我就从这一步开始，专注 15 分钟'), 'Light diagnosis can route into focus');
assert(visible.includes('报这个词'), 'Dictation has local voice playback control');
assert(visible.includes('家长暂停键'), 'Focus exposes parent pause key');
assert(visible.includes('isDevMode && isBetaTester'), 'Profile keeps trial checklist behind dev mode');

console.log('All light-heavy service loop tests pass.');
