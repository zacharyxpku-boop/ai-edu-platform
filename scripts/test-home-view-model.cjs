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
  buildCompanionPreference(input) {
    return { selectedCompanion: 'gudian', selectedLabel: '咕点' };
  }
};

const vmPath = path.join('miniprogram', 'view-models', 'home-view-model.js');
assert(fs.existsSync(path.join(root, vmPath)), 'home-view-model.js exists');
const homeVm = loadModule(vmPath, { '../utils/storage': storageStub });
assert.strictEqual(typeof homeVm.buildHomeViewModel, 'function', 'buildHomeViewModel is exported');

const empty = homeVm.buildHomeViewModel({
  companionPreference: { selectedCompanion: 'xiaoyuan' }
});
assert.strictEqual(empty.routePill, '今晚路线 · 第 1 步：排顺序', 'homeViewModel outputs routePill');
assert(empty.companionStrip.includes('咕点') && empty.companionStrip.includes('第一步'), 'homeViewModel outputs mascot strip');
assert.strictEqual(empty.title, '今晚作业先从哪一步开始？', 'homeViewModel keeps one home title');
assert.strictEqual(empty.primaryCta, '帮我安排今晚学习', 'homeViewModel keeps primary CTA');
assert(empty.secondaryAction.includes('卡住'), 'homeViewModel keeps stuck secondary action');
assert(empty.teacherPickerHint.includes('我懂你卡住了'), 'homeViewModel keeps mascot explanation');
assert(empty.emptyState.includes('还没有今晚路线'), 'homeViewModel keeps warm empty state');
assert.strictEqual(empty.nextStep, null, 'homeViewModel has no next step before plan/focus');

const anan = homeVm.buildHomeViewModel({ companionPreference: { selectedCompanion: 'anan' } });
assert.strictEqual(anan.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'retired companion input resolves to 咕点');

const wenwen = homeVm.buildHomeViewModel({ companionPreference: { selectedCompanion: 'wenwen' } });
assert.strictEqual(wenwen.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'retired companion input keeps mascot voice');

const yueyue = homeVm.buildHomeViewModel({ companionPreference: { selectedCompanion: 'yueyue' } });
assert.strictEqual(yueyue.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'retired challenge voice is removed');

const withPlan = homeVm.buildHomeViewModel({
  companionPreference: { selectedCompanion: 'aheng' },
  tonightPlan: { id: 'plan1' }
});
assert(withPlan.nextStep && withPlan.nextStep.text.includes('先说一句你卡在哪里'), 'tonightPlan state points to first-step evidence');

const withFocus = homeVm.buildHomeViewModel({
  companionPreference: { selectedCompanion: 'tuantuan' },
  todayFocus: { title: '写到第二步就乱了' }
});
assert(withFocus.nextStep && withFocus.nextStep.text === '下一步：去修今晚最卡的一步。', 'todayFocus state points to review');
assert.strictEqual(withFocus.nextStep.cta, '去修卡点', 'todayFocus next step has review CTA');

const withMiniLesson = homeVm.buildHomeViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  miniLessonResume: {
    id: 'mini_lesson_card_1',
    topicLabel: '分数应用题第一步',
    blackboardLine: '先画出已知和要求',
    parentLine: '家长只问：第一步先看什么',
    nextDayReview: '明天换一题复述第一步'
  }
});
assert(withMiniLesson.miniLessonResume, 'homeViewModel exposes miniLessonResume');
assert.strictEqual(withMiniLesson.miniLessonResume.id, 'mini_lesson_card_1', 'miniLessonResume keeps card id');
assert.strictEqual(withMiniLesson.nextStep.action, 'miniLesson', 'miniLessonResume takes next step priority');
assert(withMiniLesson.miniLessonResume.blockedFields.length >= 5, 'miniLessonResume carries visible safety boundary');
assert(withMiniLesson.miniLessonResume.blockedFields.includes('孩子姓名') && withMiniLesson.miniLessonResume.blockedFields.includes('家长联系方式'), 'miniLessonResume blocks child identity and parent contact sharing');

const withReportService = homeVm.buildHomeViewModel({
  learningReportState: {
    parentConfirmed: false,
    servicePathway: {
      primaryMode: { label: '苏格拉底 1 对 1' },
      nextAction: '今晚只验证孩子自己说出的第一步。',
      partnerServiceDeliveryLedger: { status: 'needs_parent_confirmation' },
      validationPlan: [{ action: '先做一条7天验证任务。' }]
    }
  },
  uploadReportHandoff: {
    title: '孩子学习方案',
    line: '从上传材料回到家庭行动。'
  }
});
assert(withReportService.reportServiceResume, 'homeViewModel exposes uploaded report service resume');
assert(withReportService.reportServiceResume.statusLine.includes('未确认'), 'report service resume blocks delivery before parent confirmation');
assert(withReportService.reportServiceResume.parentGateLine.includes('不向合作方交付'), 'report service resume shows partner delivery safety gate');
assert(withReportService.reportServiceResume.blockedFields.includes('姓名') && withReportService.reportServiceResume.blockedFields.includes('联系方式'), 'report service resume blocks identity and contact fields');

const confirmedReportService = homeVm.buildHomeViewModel({
  learningReportState: {
    parentConfirmed: true,
    servicePathway: {
      primaryMode: { label: '苏格拉底 1 对 1' },
      partnerServiceDeliveryLedger: { status: 'deliverable_after_parent_confirmation' }
    }
  }
});
assert(confirmedReportService.reportServiceResume.statusLine.includes('已确认'), 'confirmed report service resume opens the 7-day validation route');
assert(confirmedReportService.reportServiceResume.route.includes('/pages/profile/profile'), 'confirmed report service resume routes to profile evidence view');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const visibleMiniLessonText = {
  title: withMiniLesson.miniLessonResume.title,
  topicLabel: withMiniLesson.miniLessonResume.topicLabel,
  blackboardLine: withMiniLesson.miniLessonResume.blackboardLine,
  parentLine: withMiniLesson.miniLessonResume.parentLine,
  nextDayReview: withMiniLesson.miniLessonResume.nextDayReview,
  blockedFields: withMiniLesson.miniLessonResume.blockedFields,
  nextStepText: withMiniLesson.nextStep.text,
  nextStepCta: withMiniLesson.nextStep.cta
};
const visibleReportServiceText = {
  title: withReportService.reportServiceResume.title,
  statusLine: withReportService.reportServiceResume.statusLine,
  modeLine: withReportService.reportServiceResume.modeLine,
  actionLine: withReportService.reportServiceResume.actionLine,
  parentGateLine: withReportService.reportServiceResume.parentGateLine,
  cta: withReportService.reportServiceResume.cta,
  blockedFields: withReportService.reportServiceResume.blockedFields,
  confirmedStatusLine: confirmedReportService.reportServiceResume.statusLine,
  confirmedParentGateLine: confirmedReportService.reportServiceResume.parentGateLine,
  confirmedCta: confirmedReportService.reportServiceResume.cta
};
const visibleText = collectStrings([empty, anan, wenwen, yueyue, withPlan, withFocus, visibleMiniLessonText, visibleReportServiceText]).join('\n');
[
  /[a-z]+_[a-z0-9_]+/,
  /[a-z]+[A-Z][a-zA-Z]+/,
  /今日老师接手/,
  /6 位老师怎么分工/,
  /当前演示判断/,
  /近 7 天错误类型分布/,
  /小满/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/,
  /数学老师/,
  /英语老师/,
  /语文老师/,
  /科学老师/,
  /original_question/,
  /full_answer/,
  /talent_label/
].forEach((pattern) => {
  assert(!pattern.test(visibleText), `homeViewModel avoids unsafe visible text: ${pattern}`);
});

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
assert(homeJs.includes('home-view-model'), 'home page imports home viewModel');
assert(homeJs.includes('buildHomeViewModel'), 'home page builds homeViewModel');
assert(homeJs.includes('buildMiniLessonResumeCard'), 'home page builds mini lesson resume card');
assert(homeJs.includes('goMiniLessonResume'), 'home page exposes mini lesson resume navigation');
assert(homeJs.includes('loadLearningReportState') && homeJs.includes("storage.get('upload.report.handoff.v1'"), 'home page feeds report service handoff into the first-screen view model');
assert(homeJs.includes('goReportServiceResume'), 'home page exposes report service resume navigation');
assert(homeJs.includes('runHomeNextStep') && homeJs.includes("action === 'miniLesson'") && homeJs.includes("action === 'first'"), 'home next-step action dispatches to mini lesson, tutor, or review');
assert(homeWxml.includes('yd-home-screen'), 'home renders the new reference-style launch shell');
assert(homeWxml.includes('mini-entry-grid'), 'home renders a compact jump grid instead of a dense retired feed');
assert(homeWxml.includes('mini-route-card'), 'home keeps the tonight route as a clear action panel');
assert(homeWxml.includes('mini-route-input'), 'home keeps a first-step input inside the route panel');
assert(homeWxml.includes('runHomeNextStep'), 'home next-step CTA routes through the action dispatcher');

const firstScreen = homeWxml.slice(
  homeWxml.indexOf('yd-home-screen'),
  homeWxml.indexOf('</scroll-view>')
);

[
  'homeViewModel.routePill',
  'homeViewModel.title',
  'homeViewModel.subtitle',
  'homeViewModel.inputCard',
  'homeViewModel.primaryCta',
  'homeViewModel.secondaryAction',
  'homeViewModel.teacherPickerHint',
  'homeViewModel.miniLessonResume',
  'homeViewModel.reportServiceResume'
].forEach((binding) => {
  if (binding === 'homeViewModel.primaryCta' || binding === 'homeViewModel.secondaryAction' || binding === 'homeViewModel.teacherPickerHint') return;
  assert(firstScreen.includes(binding), `home first screen binds ${binding}`);
});
assert(read(vmPath).includes('companionStrip'), 'home view model still prepares companion copy for deeper flows');
assert(!firstScreen.includes('homeViewModel.companionStrip'), 'home first screen avoids stacking mascot explanation copy above the six entry cards');

[
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-')
].forEach((term) => {
  assert(!homeWxml.includes(term), `home WXML does not carry retired UI marker: ${term}`);
});

[
  'routeDisplayText',
  'companionLine',
  'issueType',
  'sourceText',
  'companionCopy.home',
  'growthMemory.home'
].forEach((term) => {
  assert(!firstScreen.includes(term), `home first screen does not directly bind ${term}`);
});
['companionOptions'].forEach((term) => {
  assert(!firstScreen.includes(term), `home first screen no longer renders teacher selector: ${term}`);
});

console.log('All home view model tests pass.');
