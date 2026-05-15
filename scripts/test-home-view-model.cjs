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
assert.strictEqual(anan.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'legacy companion input resolves to 咕点');

const wenwen = homeVm.buildHomeViewModel({ companionPreference: { selectedCompanion: 'wenwen' } });
assert.strictEqual(wenwen.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'legacy companion input keeps mascot voice');

const yueyue = homeVm.buildHomeViewModel({ companionPreference: { selectedCompanion: 'yueyue' } });
assert.strictEqual(yueyue.companionStrip, '咕点：我懂你卡住了，我陪你先迈出第一步。', 'legacy challenge voice is removed');

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

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const visibleText = collectStrings([empty, anan, wenwen, yueyue, withPlan, withFocus]).join('\n');
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
  /科学老师/
].forEach((pattern) => {
  assert(!pattern.test(visibleText), `homeViewModel avoids unsafe visible text: ${pattern}`);
});

const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
assert(homeJs.includes('home-view-model'), 'home page imports home viewModel');
assert(homeJs.includes('buildHomeViewModel'), 'home page builds homeViewModel');

const firstScreen = [
  homeWxml.slice(homeWxml.indexOf('rc14-home-first-screen-top'), homeWxml.indexOf('rc14-home-after-first-screen-top')),
  homeWxml.slice(homeWxml.indexOf('rc14-home-first-screen-card'), homeWxml.indexOf('rc14-home-after-first-screen-card'))
].join('\n');

[
  'homeViewModel.routePill',
  'homeViewModel.companionStrip',
  'homeViewModel.title',
  'homeViewModel.subtitle',
  'homeViewModel.inputCard',
  'homeViewModel.primaryCta',
  'homeViewModel.secondaryAction',
  'homeViewModel.teacherPickerHint'
].forEach((binding) => {
  assert(firstScreen.includes(binding), `home first screen binds ${binding}`);
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
['companionOptions', '{{item.label}}', '{{item.short}}'].forEach((term) => {
  assert(!firstScreen.includes(term), `home first screen no longer renders teacher selector: ${term}`);
});

console.log('All home view model tests pass.');
