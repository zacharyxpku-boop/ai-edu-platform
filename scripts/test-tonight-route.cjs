#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function readProjectFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

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

function loadStorage() {
  const file = path.join(root, 'miniprogram', 'utils', 'storage.js');
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(request) {
      if (request === './learning-priority') return {};
      return require(request);
    },
    console,
    wx: global.wx,
    Date,
    Math,
    RegExp,
    String,
    Number,
    Object,
    Array
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const storage = loadStorage();
storage.clearLearningData();

const focus = storage.saveTodayFocusFromThought('数学应用题我不知道下一步怎么列式。', { source: 'route_test' });
assert.strictEqual(focus.issueType, '步骤断点', 'seed focus has a step-break issue type');

storage.saveReviewCards([
  {
    id: 'rc_due_focus',
    source: 'today_focus',
    sourceFocusId: focus.id,
    question: '这类题第一步应该先找什么？',
    answer: '先找已知条件，再判断关系。',
    due: new Date(Date.now() - 1000).toISOString(),
    dueDate: new Date(Date.now() - 1000).toISOString(),
    status: 'new'
  },
  {
    id: 'rc_future',
    source: 'manual_import',
    question: '未来再复习',
    answer: '方法提示',
    due: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'new'
  }
]);

const plan = storage.createTonightPlanFromInput(
  [
    '数学应用题 3 道，明天必交',
    '英语单词 10 分钟，明天听写',
    '数学拓展题 2 道',
    '语文预习课文'
  ].join('\n'),
  { availableMinutes: 45, source: 'test' }
);

assert.ok(plan && plan.id, 'creates a local tonight plan');
assert.strictEqual(plan.availableMinutes, 45, 'keeps available minutes');
assert.strictEqual(plan.focusId, focus.id, 'links current todayFocus');
assert.ok(plan.reviewCardIds.includes('rc_due_focus'), 'schedules due today-focus review card');
assert.ok(plan.planItems.length >= 4, 'creates plan items from homework list');
assert.ok(plan.parentAdvice.includes('第一步'), 'parent advice asks about the first step');
assert.ok(!/不用做|跳过|答案|秒解|拍照出答案|答案已生成/.test(JSON.stringify(plan)), 'route copy avoids answer-tool and school-conflict wording');

const first = plan.planItems[0];
assert.ok(first.title.includes('数学应用题'), 'issue-related required homework ranks first');
assert.strictEqual(first.priorityLabel, '先做', 'top item is marked as first');
assert.ok(first.reason.includes('卡点') || first.reason.includes('必交'), 'top item explains route reasoning');

const extension = plan.planItems.find((item) => item.title.includes('拓展'));
assert.ok(extension, 'keeps extension homework in the route');
assert.ok(['后置', '明天问老师'].includes(extension.priorityLabel), 'extension does not steal the main priority');

const english = plan.planItems.find((item) => item.title.includes('英语'));
assert.ok(english, 'keeps short required task');
assert.ok(['认真做', '快速做'].includes(english.priorityLabel), 'short necessary task can be slotted without becoming top');

assert.ok(plan.summaryLine.includes('今晚建议顺序'), 'has human-readable route summary');
assert.ok(plan.routeSteps.some((step) => step.id === 'plan' && step.active), 'home route step can highlight planning');
assert.ok(storage.loadTonightPlan().id === plan.id, 'persists tonight plan');

const statusAfterFocus = storage.updateTonightRouteStatus('focus_created');
assert.strictEqual(statusAfterFocus.routeStatus, 'focus_created', 'route status can move to focus_created');
const statusAfterRepair = storage.updateTonightRouteStatus('repaired');
assert.strictEqual(statusAfterRepair.routeStatus, 'repaired', 'route status can move to repaired');
const statusAfterReview = storage.updateTonightRouteStatus('review_scheduled');
assert.strictEqual(statusAfterReview.routeStatus, 'review_scheduled', 'route status can move to review_scheduled');
assert.ok(statusAfterReview.routeSteps.some((step) => step.id === 'review' && step.active), 'review scheduled route highlights light review');

const files = {
  homeWxml: readProjectFile('miniprogram', 'pages', 'home', 'home.wxml'),
  homeJs: readProjectFile('miniprogram', 'pages', 'home', 'home.js'),
  homeViewModelJs: readProjectFile('miniprogram', 'view-models', 'home-view-model.js'),
  reviewWxml: readProjectFile('miniprogram', 'pages', 'review', 'review.wxml'),
  reviewJs: readProjectFile('miniprogram', 'pages', 'review', 'review.js'),
  reviewViewModelJs: readProjectFile('miniprogram', 'view-models', 'review-view-model.js'),
  toolsWxml: readProjectFile('miniprogram', 'pages', 'tools', 'tools.wxml'),
  toolsJs: readProjectFile('miniprogram', 'pages', 'tools', 'tools.js'),
  toolsViewModelJs: readProjectFile('miniprogram', 'view-models', 'tools-view-model.js'),
  profileWxml: readProjectFile('miniprogram', 'pages', 'profile', 'profile.wxml'),
  profileJs: readProjectFile('miniprogram', 'pages', 'profile', 'profile.js'),
  profileViewModelJs: readProjectFile('miniprogram', 'view-models', 'profile-view-model.js')
};

const allPageCopy = [
  files.homeWxml,
  files.homeJs,
  files.homeViewModelJs,
  files.reviewWxml,
  files.reviewViewModelJs,
  files.toolsWxml,
  files.toolsViewModelJs,
  files.profileViewModelJs || '',
  files.profileWxml
].join('\n');

assert.ok(files.homeWxml.includes('{{homeViewModel.primaryCta}}') && files.homeViewModelJs.includes('primaryCta'), 'home renders Tonight Route primary CTA through homeViewModel');
assert.ok(files.homeWxml.includes('{{homeViewModel.secondaryAction}}') && files.homeViewModelJs.includes('secondaryAction'), 'home keeps first-step secondary entry through homeViewModel');
assert.ok(files.reviewWxml.includes('{{reviewViewModel.primaryCta.text}}') && allPageCopy.includes('开始 5 分钟修复'), 'review keeps repair primary CTA through viewModel');
assert.ok(files.toolsWxml.includes('{{toolsViewModel.primaryCta.text}}') && files.toolsViewModelJs.includes('先去说第一步'), 'tools empty state routes back to a real stuck point');
assert.ok(files.profileWxml.includes('{{profileViewModel.primaryCta}}') && allPageCopy.includes('完成今日复盘'), 'profile keeps parent recap primary CTA through viewModel');

['排顺序', '说第一步', '修卡点', '轻回访', '家长看'].forEach((label) => {
  assert.ok(allPageCopy.includes(label), `route stage ${label} is visible in tab pages`);
});

assert.ok(files.homeJs.includes("buildRouteStrip('plan'"), 'home highlights planning stage');
assert.ok(files.reviewJs.includes("buildRouteStrip('repair'"), 'review highlights repair stage');
assert.ok(files.toolsJs.includes("buildRouteStrip('review'"), 'tools highlights light review stage');
assert.ok(files.profileJs.includes("buildRouteStrip('parent'"), 'profile highlights parent stage');

assert.ok(files.homeJs.includes('createTonightPlanFromInput') && files.homeJs.includes('planTonight'), 'home can generate tonightPlan');
assert.ok(files.homeViewModelJs.includes('tonightPlan'), 'home guides user to follow the route after planning through homeViewModel');
assert.ok(files.homeViewModelJs.includes('todayFocus') && files.homeViewModelJs.includes("action: 'review'"), 'home guides stuck user to repair focus through homeViewModel');
assert.ok(files.reviewWxml.includes('已生成明天回访卡。下一步：去轻轻回访。') && files.reviewWxml.includes('去轻回访'), 'review completion leads to light review');
assert.ok(files.toolsJs.includes("source: 'today_focus'") && files.toolsWxml.includes('{{toolsViewModel.primaryCard.title}}') && files.toolsViewModelJs.includes('回看昨天那一步') && files.toolsViewModelJs.includes('轻轻回看'), 'tools reads today-focus review cards');
assert.ok(
  files.profileWxml.includes('今晚卡住')
    && files.profileWxml.includes('只问一句')
    && files.profileWxml.includes('最近小结')
    && files.profileViewModelJs.includes('今晚孩子卡在')
    && files.profileViewModelJs.includes('家长只问一句')
    && files.profileViewModelJs.includes('信任边界'),
  'profile shows a condensed parent-readable route summary through viewModel'
);
assert.ok(files.profileJs.includes("review: '/pages/review/review'") && files.profileJs.includes('wx.switchTab'), 'profile review action switches to tab page');
assert.ok(!/这项不用做|秒解|拍照出答案|答案已生成/.test(allPageCopy), 'tab pages avoid banned answer-tool and school-conflict copy');

console.log('All tonight route tests pass.');
