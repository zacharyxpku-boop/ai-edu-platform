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
  formatIssueType(value, fallback) {
    const map = {
      step_break: '步骤断点',
      relation_setup: '列式关系'
    };
    return map[value] || value || fallback || '思路卡点';
  },
  formatInternalLabel(value, fallback) {
    if (!value || /[a-z]+_[a-z0-9_]+/.test(String(value))) return fallback || '先说第一步';
    return String(value);
  },
  buildCompanionPreference() {
    return { selectedCompanion: 'gudian', selectedLabel: '咕点' };
  },
  getCompanionStageCopy() {
    return '咕点陪你只修今晚最卡的一步，不讲完整答案。';
  },
  normalizeFirstStepEvidence(focus = {}) {
    const systemSuggestedStep = focus.systemSuggestedStep || '先看题目问的是什么。';
    const childArticulatedStep = focus.childArticulatedStep || focus.childStepSentence || '';
    return {
      systemSuggestedStep,
      childArticulatedStep,
      childStepSentence: childArticulatedStep,
      childStepQuality: childArticulatedStep ? 'actionable' : 'empty',
      quickChoices: ['我先圈出题干条件', '我先找关键词']
    };
  },
  buildBlackboardHint() {
    return { structure: '先看题目问什么，再找第一步。' };
  }
};

const vmPath = path.join('miniprogram', 'view-models', 'review-view-model.js');
assert(fs.existsSync(path.join(root, vmPath)), 'review-view-model.js exists');
const reviewVm = loadModule(vmPath, { '../utils/storage': storageStub });
assert.strictEqual(typeof reviewVm.buildReviewViewModel, 'function', 'buildReviewViewModel is exported');

const vmWithFocus = reviewVm.buildReviewViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  todayFocus: {
    title: '写到第二步就乱了',
    issueType: 'step_break',
    repairStatus: 'in_progress',
    sourceText: '我写到第二步就乱了',
    systemSuggestedStep: '先看题目问的是什么。'
  }
});

assert.strictEqual(vmWithFocus.routePill, '今晚路线 · 第 3 步：修卡点', 'viewModel outputs routePill');
assert(vmWithFocus.companionStrip.includes('咕点'), 'viewModel outputs mascot strip');
assert.strictEqual(vmWithFocus.title, '今晚只修一个卡点', 'viewModel keeps one review title');
assert(vmWithFocus.subtitle.includes('最卡的这一步'), 'viewModel keeps first-step subtitle');
assert(vmWithFocus.primaryCard.sections.some((item) => item.label === '今天卡在哪'), 'primary card shows stuck point');
assert(vmWithFocus.primaryCard.sections.some((item) => item.label === '咕点建议你先看'), 'primary card shows system suggestion');
assert(vmWithFocus.primaryCard.sections.some((item) => item.label === '你自己的第一步'), 'primary card shows child first step slot');
assert(vmWithFocus.miniAction && vmWithFocus.miniAction.question.includes('我先'), 'missing child step exposes gentle confirmation prompt');
assert(vmWithFocus.miniAction.quickChoices.includes('我先圈出题干条件'), 'mini action exposes quick choices');

const vmConfirmed = reviewVm.buildReviewViewModel({
  todayFocus: {
    title: '题干条件多',
    issueType: 'relation_setup',
    repairStatus: 'in_progress',
    systemSuggestedStep: '先把题干里的已知条件圈出来。',
    childArticulatedStep: '我先圈出题干条件'
  }
});
assert.strictEqual(vmConfirmed.miniAction, null, 'confirmed child step hides confirmation prompt');
assert.strictEqual(vmConfirmed.primaryCta.action, 'complete', 'confirmed child step can complete repair');

const vmCompleted = reviewVm.buildReviewViewModel({
  todayFocus: {
    title: '单位1不确定',
    issueType: 'relation_setup',
    repairStatus: 'completed',
    childArticulatedStep: '我先找等量关系'
  }
});
assert.strictEqual(vmCompleted.primaryCta.action, 'tools', 'completed CTA action is light recall');

const vmEmpty = reviewVm.buildReviewViewModel({});
assert(vmEmpty.emptyState && vmEmpty.emptyState.text.includes('还没有要修的卡点'), 'empty state is warm');
assert.strictEqual(vmEmpty.emptyState.cta, '去说第一步', 'empty state routes to first step');
assert.strictEqual(vmEmpty.primaryCta.text, '去说第一步', 'empty state primary CTA is first step');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const visibleText = collectStrings([vmWithFocus, vmConfirmed, vmCompleted, vmEmpty]).join('\n');
[
  /systemSuggestedStep/,
  /childArticulatedStep/,
  /系统诊断/,
  /家长应盯着/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/
].forEach((pattern) => {
  assert(!pattern.test(visibleText), `reviewViewModel avoids unsafe visible text: ${pattern}`);
});

const reviewJs = read('miniprogram/pages/review/review.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
assert(reviewJs.includes('review-view-model'), 'review page imports review viewModel');
assert(reviewJs.includes('buildReviewViewModel'), 'review page builds reviewViewModel');

const firstScreen = reviewWxml.slice(
  reviewWxml.indexOf('rc14-review-first-screen'),
  reviewWxml.indexOf('rc14-review-after-first-screen')
);
assert(firstScreen.includes('reviewViewModel.routePill'), 'first screen reads routePill from reviewViewModel');
assert(firstScreen.includes('reviewViewModel.primaryCard.sections'), 'first screen renders primary card sections from reviewViewModel');

console.log('All review view model tests pass.');
