#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function assertIncludes(text, needle, message) {
  assert(text.includes(needle), message || `Expected text to include "${needle}"`);
}

function assertNotIncludes(text, needle, message) {
  assert(!text.includes(needle), message || `Expected text to avoid "${needle}"`);
}

const appJson = JSON.parse(read('miniprogram/app.json'));
const tabLabels = appJson.tabBar.list.map((item) => item.text);
assert.deepStrictEqual(
  tabLabels,
  ['作业点拨', '修卡点', '专注舱', '轻回访', '我的'],
  'tab labels should stay aligned to the user route'
);

const customTab = read('miniprogram/custom-tab-bar/index.wxml');
['作业点拨', '专注舱', '轻回访', '修卡点', '我的'].forEach((label) => {
  assertIncludes(customTab, label, `custom tab should render ${label}`);
});

const routeShellFiles = [
  'miniprogram/app.json',
  'miniprogram/custom-tab-bar/index.wxml',
  'miniprogram/view-models/home-view-model.js',
  'miniprogram/pages/home/home.js',
  'miniprogram/pages/home/home.wxml',
  'miniprogram/pages/focus/focus.js',
  'miniprogram/pages/focus/focus.wxml',
  'miniprogram/pages/upload/upload.js',
  'miniprogram/pages/upload/upload.wxml',
  'miniprogram/pages/module/module.wxml',
  'miniprogram/pages/radar/radar.js',
  'miniprogram/pages/review/review.wxml',
  'miniprogram/pages/review/review.js',
  'miniprogram/pages/tools/tools.wxml',
  'miniprogram/pages/tools/tools.js',
  'miniprogram/pages/profile/profile.wxml',
  'miniprogram/pages/profile/profile.js',
  'miniprogram/pages/arcade/arcade.wxml',
  'miniprogram/pages/arcade/arcade.js'
];

const routeShellText = routeShellFiles.map(read).join('\n');

[
  '知识游乐场',
  '错题闭环',
  '复习闯关',
  '知识闯关',
  '知识关卡',
  '同学同关练',
  '请老师看一眼',
  '学习游戏档案',
  '成长报告',
  '服务方案',
  '免费体验',
  '¥0',
  '支付',
  '课程售卖',
  '访谈验证',
  '可访谈',
  '学币'
].forEach((term) => {
  assertNotIncludes(routeShellText, term, `route shell should avoid legacy wording: ${term}`);
});

assertIncludes(routeShellText, '去轻回访', 'review completion should point to light recall');
assertIncludes(routeShellText, '家长 5 秒复盘', 'profile shell should stay parent recap oriented');
assertIncludes(routeShellText, '轻回访记录', 'profile should describe recall records instead of game records');
assertIncludes(routeShellText, '可分享的复盘卡', 'share panel should use recap language');
assertIncludes(routeShellText, '内容回访', 'benchmark panels should avoid challenge framing');
assertNotIncludes(routeShellText, '上线准备', 'advanced profile shell should avoid internal launch framing');
assertIncludes(routeShellText, '去修卡点', 'home route should point to repair instead of wrongbook closure');
assertIncludes(routeShellText, '打开轻回访', 'module page should route into light recall wording');
assertIncludes(routeShellText, '导入轻回访', 'upload page should route materials into light recall wording');
assertIncludes(routeShellText, '学习复盘卡', 'shared entry should use recap card wording');
assertIncludes(routeShellText, '打开轻练习', 'supporting practice surfaces should use light-practice wording');
assertIncludes(routeShellText, '轻练习工坊', 'content generation surface should avoid challenge factory wording');

const toolsJs = read('miniprogram/pages/tools/tools.js');
assertIncludes(toolsJs, '轻练习输出', 'tools study-pack output should use light-practice wording');
assertIncludes(toolsJs, '请粘贴真实学习材料后再生成轻练习。', 'tools empty state should avoid challenge wording');

console.log('All RC5 product shell tests pass.');
