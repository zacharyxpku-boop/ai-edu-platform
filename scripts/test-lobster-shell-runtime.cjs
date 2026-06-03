#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'lobster.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function createElement(id) {
  const element = {
    id,
    hidden: false,
    handlers: {},
    _innerHTML: '',
    value: '',
    dataset: {},
    addEventListener(type, handler) {
      this.handlers[type] = handler;
    },
    classList: {
      toggle() {}
    }
  };
  Object.defineProperty(element, 'innerHTML', {
    get() {
      return this._innerHTML;
    },
    set(value) {
      this._innerHTML = String(value);
    }
  });
  return element;
}

const elements = {
  'lobster-config-form': createElement('lobster-config-form'),
  'activation-result': createElement('activation-result'),
  'delivery-channel': Object.assign(createElement('delivery-channel'), { value: 'feishu' })
};

const fetchCalls = [];
const context = {
  console,
  document: {
    getElementById(id) {
      return elements[id] || null;
    },
    querySelectorAll(selector) {
      if (selector === '.channel-card') {
        return [
          Object.assign(createElement('web-card'), { dataset: { channel: 'web' } }),
          Object.assign(createElement('feishu-card'), { dataset: { channel: 'feishu' } }),
          Object.assign(createElement('dingtalk-card'), { dataset: { channel: 'dingtalk' } })
        ];
      }
      return [];
    }
  },
  FormData: class FormDataMock {
    constructor() {}
    entries() {
      return [
        ['familyName', 'Runtime family'],
        ['childAlias', 'Kid'],
        ['gradeBand', 'grade 5'],
        ['subjects', 'math, english'],
        ['deliveryChannel', 'feishu'],
        ['parentObservation', 'score 82 and homework anxiety'],
        ['childMessage', 'I do not know the first step.']
      ][Symbol.iterator]();
    }
  },
  fetch: async (url, options = {}) => {
    fetchCalls.push({ url: String(url), method: options.method || 'GET', body: options.body || '' });
    if (String(url).startsWith('/api/lobster-teacher')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          activationId: 'lobster-runtime-family',
          positioning: '家长设备里的统一 AI 教师。',
          entry: { primary: '/lobster.html#activate=lobster-runtime-family' },
          modes: {
            parent: { firstAction: 'Review one score and one first step.' },
            childCoView: { childLine: 'Tell me where you are stuck first.' },
            teacherPresence: {
              proactiveFollowUp: {
                reminders: [{ title: 'Tonight first step', action: 'Open child co-view.' }]
              }
            }
          }
        })
      };
    }
    throw new Error(`Unexpected fetch ${url}`);
  }
};

vm.createContext(context);
new vm.Script(script, { filename: 'lobster.html inline script' }).runInContext(context);

(async () => {
  const form = elements['lobster-config-form'];
  const result = elements['activation-result'];
  assert.strictEqual(typeof form.handlers.submit, 'function', 'submit handler is registered');

  await form.handlers.submit({ preventDefault() {} });
  await new Promise((resolve) => setImmediate(resolve));

  assert(fetchCalls.some((call) => call.url === '/api/lobster-teacher' && call.method === 'POST'), 'submit calls teacher API');
  const teacherCall = fetchCalls.find((call) => call.url === '/api/lobster-teacher');
  assert(teacherCall.body.includes('"deliveryChannel":"feishu"'), 'teacher payload includes selected channel');
  assert(teacherCall.body.includes('"childChannel":"feishu"'), 'teacher payload maps delivery channel into child channel');
  assert.strictEqual(result.hidden, false, 'result panel becomes visible');
  assert(result.innerHTML.includes('/api/lobster-message?mode=channel&channel=feishu'), 'result renders feishu webhook');
  assert(result.innerHTML.includes('飞书'), 'result labels selected feishu channel');
  assert(!fetchCalls.some((call) => /phone|wechatId|qqId/.test(call.body)), 'runtime payload does not include contact identifiers');

  console.log('Lobster shell runtime tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
