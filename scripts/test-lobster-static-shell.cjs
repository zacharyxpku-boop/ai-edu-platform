#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const shellPath = path.join(root, 'lobster.html');
const html = fs.readFileSync(shellPath, 'utf8');

assert(html.includes('<form class="panel form-grid" id="lobster-config-form">'), 'lobster shell has the family configuration form');
assert(html.includes('/api/lobster-teacher'), 'lobster shell calls the unified teacher API');
assert(html.includes('/api/lobster-message?mode=channel&channel=feishu'), 'lobster shell documents feishu webhook');
assert(html.includes('/api/lobster-message?mode=channel&channel=dingtalk'), 'lobster shell documents dingtalk webhook');
assert(html.includes('/api/lobster-message?mode=channel&action=send_plan'), 'lobster shell documents channel send plan API');
assert(html.includes('飞书机器人'), 'lobster shell prioritizes feishu bot');
assert(html.includes('钉钉机器人'), 'lobster shell prioritizes dingtalk bot');
assert(html.includes('微信后续官方适配'), 'lobster shell defers wechat to official adapter');
assert(html.includes('不做个人号外挂'), 'lobster shell blocks personal-account bot route');
assert(!/name="(?:phone|mobile|wechatId|qqId|contact)"|rawDialogue/.test(html), 'lobster shell does not request contact identifiers or raw dialogue');

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'lobster shell has an inline script');
new vm.Script(scriptMatch[1], { filename: 'lobster.html inline script' });

[
  'function channelMeta',
  'function renderResult',
  "fetch('/api/lobster-teacher'",
  "channel=dingtalk",
  "channel=feishu",
  "channelSelect.addEventListener"
].forEach((needle) => {
  assert(html.includes(needle), `lobster shell includes ${needle}`);
});

console.log('Lobster static shell tests pass.');
