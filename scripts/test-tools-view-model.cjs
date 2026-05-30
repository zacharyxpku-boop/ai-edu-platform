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
  buildCompanionPreference() {
    return { selectedCompanion: 'gudian', selectedLabel: '咕点' };
  },
  getCompanionStageCopy(stage) {
    if (stage === 'tools_empty') return '还没有回访卡。先修过一小步，明天咕点再来轻轻看。';
    return '咕点陪你轻轻回访。';
  }
};

const vmPath = path.join('miniprogram', 'view-models', 'tools-view-model.js');
assert(fs.existsSync(path.join(root, vmPath)), 'tools-view-model.js exists');
const toolsVm = loadModule(vmPath, { '../utils/storage': storageStub });
assert.strictEqual(typeof toolsVm.buildToolsViewModel, 'function', 'buildToolsViewModel is exported');

const completed = toolsVm.buildToolsViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  latestFocusSession: {
    completionType: 'completed',
    taskBound: true,
    linkedChildArticulatedStep: '我先圈出题干条件',
    focusTarget: { title: '我先圈出题干条件' }
  }
});

assert.strictEqual(completed.routePill, '今晚路线 · 第 4 步：明天轻轻回访', 'viewModel outputs routePill');
assert(completed.companionStrip.includes('咕点'), 'viewModel outputs mascot strip');
assert.strictEqual(completed.title, '今天只回看这一小步', 'viewModel keeps one tools title');
assert.strictEqual(completed.primaryCard.title, '回看昨天那一步', 'primary card names light revisit');
assert(completed.primaryCard.body.includes('已经坐过一段'), 'completed focus evidence gets completed revisit copy');
assert(completed.primaryCard.reviewTitle.includes('我先圈出题干条件'), 'primary card uses exact first step');
assert(completed.primaryCard.questions.includes('昨天你第一步先看了哪里？'), 'primary card uses light revisit questions');
assert.strictEqual(completed.primaryCta.text, '轻轻回看', 'review evidence keeps light CTA');
assert.strictEqual(completed.primaryCta.action, 'review', 'review CTA action is stable');
assert(completed.nextStep && completed.nextStep.cta === '去我的页', 'review card state points to profile');

const interrupted = toolsVm.buildToolsViewModel({
  latestFocusSession: {
    completionType: 'interrupted',
    taskBound: true,
    linkedSystemSuggestedStep: '先找等量关系',
    focusTarget: { title: '先找等量关系' }
  }
});
assert(interrupted.primaryCard.body.includes('停在这里'), 'interrupted focus evidence gets gentle continuation copy');

const empty = toolsVm.buildToolsViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  reviewCards: []
});
assert(empty.companionStrip.includes('咕点'), 'empty state uses mascot strip');
assert.strictEqual(empty.primaryCta.text, '先去说第一步', 'empty state routes back to first step');
assert.strictEqual(empty.primaryCta.action, 'review', 'empty state stays in product loop');
assert(empty.primaryCard.body.includes('说出第一步'), 'empty state explains evidence timing');
assert.strictEqual(empty.nextStep, null, 'empty state does not point to profile yet');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const visibleText = collectStrings([completed, interrupted, empty]).join('\n');
[
  /quiz/i,
  /wrong-question/i,
  /系统诊断/,
  /报告墙/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/
].forEach((pattern) => {
  assert(!pattern.test(visibleText), `toolsViewModel avoids unsafe visible text: ${pattern}`);
});

const toolsJs = read('miniprogram/pages/tools/tools.js');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
assert(toolsJs.includes('tools-view-model'), 'tools page imports tools viewModel');
assert(toolsJs.includes('latestFocusSession'), 'tools page passes latest focus evidence');

const firstScreen = toolsWxml.slice(
  toolsWxml.indexOf('rc14-tools-first-screen'),
  toolsWxml.indexOf('rc14-tools-after-first-screen')
);
assert(firstScreen.includes('toolsViewModel.routePill'), 'first screen reads routePill from toolsViewModel');
assert(firstScreen.includes('toolsViewModel.primaryCard'), 'first screen renders primary card from toolsViewModel');
assert(firstScreen.includes('toolsViewModel.primaryCta.text'), 'first screen renders primary CTA from toolsViewModel');
assert(firstScreen.includes('bindtap="goFirstStep"'), 'empty revisit CTA returns to first-step tutor instead of arcade');
assert(toolsJs.includes("goFirstStep()") && toolsJs.includes("/pages/tutor/tutor?from=tools_empty_revisit"), 'tools empty loop has a real first-step route');

console.log('All tools view model tests pass.');
