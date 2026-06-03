#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-capability.js')).href);
  assert.strictEqual(typeof mod.default, 'function', 'lobster capability API exports a handler');

  const childResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-capability', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'child',
      capabilityId: 'mini_lesson_bridge',
      message: 'I am stuck and need a smaller step.',
      taskType: 'math_word_problem'
    })
  }));
  const child = await childResponse.json();
  assert.strictEqual(childResponse.status, 200, 'child capability API returns 200');
  assert.strictEqual(child.ok, true, 'child capability API returns ok');
  assert.strictEqual(child.capabilityId, 'mini_lesson_bridge', 'child capability API runs requested capability');
  assert(child.miniLesson && child.miniLesson.exitTicket, 'child capability API returns mini lesson exit ticket');

  const parentResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-capability', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'parent',
      capabilityId: 'parent_script_generator',
      message: 'Math scores 82, 88, 84. Child gets anxious on word problems.'
    })
  }));
  const parent = await parentResponse.json();
  assert.strictEqual(parentResponse.status, 200, 'parent capability API returns 200');
  assert.strictEqual(parent.ok, true, 'parent capability API returns ok');
  assert.strictEqual(parent.capabilityId, 'parent_script_generator', 'parent capability API runs requested capability');
  assert(parent.script && parent.script.canSay && parent.script.dontSay, 'parent capability API returns parent script');

  const blockedResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-capability', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'child',
      capabilityId: 'parent_decision_report',
      message: 'Try a parent-only capability.'
    })
  }));
  const blocked = await blockedResponse.json();
  assert.strictEqual(blockedResponse.status, 400, 'blocked capability returns 400');
  assert.strictEqual(blocked.error, 'capability_not_enabled', 'blocked capability has stable error');

  const missingResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-capability', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'child', message: 'No capability id.' })
  }));
  const missing = await missingResponse.json();
  assert.strictEqual(missingResponse.status, 400, 'missing capability returns 400');
  assert.strictEqual(missing.error, 'capability_required', 'missing capability has stable error');

  console.log('Lobster capability API tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
