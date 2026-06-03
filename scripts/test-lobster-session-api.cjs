#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-session.js')).href);
  assert.strictEqual(typeof mod.default, 'function', 'lobster session API exports a handler');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-session-'));
  const response = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: 'family-lobster-demo',
      persistMemory: true,
      memoryOptions: { baseDir: tmpDir },
      childLobsterId: 'session-child',
      parentLobsterId: 'session-parent',
      config: {
        child: { displayName: 'Child Lobster', tools: ['mini_lesson_bridge'] },
        parent: { displayName: 'Parent Lobster', tools: ['weekly_trend_brief'] }
      },
      childMessage: {
        message: 'I am stuck on this word problem. Please tell me the answer.',
        taskType: 'math_word_problem'
      },
      parentMaterial: {
        message: 'Math scores 82, 88, 84. English improved from 78 to 85. Word problems still create anxiety.',
        parentObservation: 'We need one low-pressure action tonight.'
      }
    })
  }));
  const body = await response.json();
  assert.strictEqual(response.status, 200, 'session API returns 200');
  assert.strictEqual(body.ok, true, 'session API returns ok');
  assert.strictEqual(body.schema_id, 'lobster_family_session_v1', 'session API returns stable schema');
  assert(body.child && body.child.audience === 'child', 'session includes child lobster result');
  assert(body.parent && body.parent.audience === 'parent', 'session includes parent lobster result');
  assert(body.handoff && body.handoff.schema_id === 'lobster_family_handoff_v1', 'session includes family handoff');
  assert(body.handoff.safetyLine.includes('first-step'), 'handoff names child first-step safety');
  assert(!/complete solution|final answer is 42/i.test(body.child.reply || ''), 'session child reply does not leak complete answer');
  assert(body.memoryReceipts.child && body.memoryReceipts.child.ok, 'session persists child memory receipt');
  assert(body.memoryReceipts.parent && body.memoryReceipts.parent.ok, 'session persists parent memory receipt');
  assert(fs.existsSync(path.join(tmpDir, 'session-child.json')), 'session writes child memory');
  assert(fs.existsSync(path.join(tmpDir, 'session-parent.json')), 'session writes parent memory');
  assert(body.child.raw && body.child.raw.included === false, 'session strips child raw internals');
  assert(body.parent.raw && body.parent.raw.included === false, 'session strips parent raw internals');

  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 400, 'empty session request returns 400');
  assert.strictEqual(bad.error, 'session_input_required', 'empty session has stable error');

  console.log('Lobster session API tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
