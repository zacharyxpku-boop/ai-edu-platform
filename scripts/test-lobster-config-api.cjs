#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-config.js')).href);
  assert.strictEqual(typeof mod.default, 'function', 'lobster config API exports a handler');

  const getResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-config', {
    method: 'GET'
  }));
  const getBody = await getResponse.json();
  assert.strictEqual(getResponse.status, 200, 'GET config returns 200');
  assert.strictEqual(getBody.schema_id, 'lobster_config_v1', 'GET config returns stable schema');
  assert(getBody.capabilities.child.some((item) => item.id === 'socratic_teacher_reply'), 'GET exposes child capabilities');
  assert(getBody.capabilities.parent.some((item) => item.id === 'parent_decision_report'), 'GET exposes parent capabilities');
  assert(getBody.defaults.child && getBody.defaults.parent, 'GET exposes default lobster pair');

  const postResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      productId: 'test-lobster',
      child: {
        displayName: 'Kid Lobster',
        gradeBand: 'G6',
        subjectFocus: ['math'],
        tools: ['mini_lesson_bridge', 'parent_decision_report']
      },
      parent: {
        displayName: 'Parent Lobster',
        gradeBand: 'G6',
        subjectFocus: ['math', 'english'],
        tools: ['weekly_trend_brief', 'socratic_teacher_reply']
      }
    })
  }));
  const postBody = await postResponse.json();
  assert.strictEqual(postResponse.status, 200, 'POST config returns 200');
  assert.strictEqual(postBody.ok, true, 'POST config returns ok');
  assert.strictEqual(postBody.productId, 'test-lobster', 'POST config preserves product id');
  assert.strictEqual(postBody.child.displayName, 'Kid Lobster', 'POST config preserves child display name');
  assert.strictEqual(postBody.parent.displayName, 'Parent Lobster', 'POST config preserves parent display name');
  assert(postBody.child.tools.includes('mini_lesson_bridge'), 'POST config enables child tool');
  assert(!postBody.child.tools.includes('parent_decision_report'), 'POST config filters parent-only tool from child lobster');
  assert(postBody.parent.tools.includes('weekly_trend_brief'), 'POST config enables parent tool');
  assert(!postBody.parent.tools.includes('socratic_teacher_reply'), 'POST config filters child-only tool from parent lobster');
  assert(postBody.warnings.includes('child:parent_decision_report:not_allowed_for_role'), 'POST config reports invalid child tool');
  assert(postBody.warnings.includes('parent:socratic_teacher_reply:not_allowed_for_role'), 'POST config reports invalid parent tool');
  assert(postBody.openSourceReferenceNotes.some((item) => item.id === 'open-maic-style-classroom'), 'POST config returns Open MAIC-style reference note');

  const methodResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-config', {
    method: 'DELETE'
  }));
  const methodBody = await methodResponse.json();
  assert.strictEqual(methodResponse.status, 405, 'unsupported methods are rejected');
  assert.strictEqual(methodBody.error, 'method_not_allowed', 'unsupported method has stable error');

  console.log('Lobster config API tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
