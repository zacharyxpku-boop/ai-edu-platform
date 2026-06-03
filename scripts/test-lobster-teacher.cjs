#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const teacher = require('../src/lobster/lobster-teacher.cjs');

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: null,
    ended: false,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

(async () => {
  const emotion = teacher.detectEmotion({
    parentObservation: '孩子一写应用题就哭，家长也很急。'
  });
  assert.strictEqual(emotion.level, 'high', 'teacher detects emotional support need');
  assert(emotion.teacherMove.includes('情绪'), 'emotion result includes teacher move');

  const workspace = teacher.buildUnifiedTeacherWorkspace({
    familyName: 'Pilot family',
    childAlias: 'Kid',
    subjects: ['math'],
    parentObservation: 'Kid is anxious and stuck on word problems.',
    childMessage: 'I do not know the first step.',
    preferredFollowUpTime: '19:30'
  });
  assert.strictEqual(workspace.ok, true, 'workspace returns ok');
  assert.strictEqual(workspace.schema_id, 'lobster_unified_teacher_workspace_v1', 'workspace has stable schema');
  assert.strictEqual(workspace.deviceModel.primaryDevice, 'parent_phone_or_computer', 'workspace is parent-device first');
  assert.strictEqual(workspace.deviceModel.childIndependentAccountRequired, false, 'child account is not required');
  assert(workspace.modes.parent.reportSummary, 'parent mode includes report summary');
  assert.strictEqual(workspace.modes.childCoView.noFinalAnswer, true, 'child co-view keeps answer boundary');
  assert.strictEqual(workspace.modes.teacherPresence.proactiveFollowUp.active, true, 'teacher has proactive follow-up plan');
  assert(workspace.modes.teacherPresence.proactiveFollowUp.reminders.length >= 3, 'follow-up plan includes daily and weekly reminders');
  assert.strictEqual(workspace.safety.externalChatBotNotRequiredForMvp, true, 'MVP does not require external chat bot');

  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-teacher.js')).href);
  const response = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-teacher', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      familyName: 'Teacher pilot',
      childAlias: 'Kid',
      parentObservation: 'The child gets angry when homework starts.',
      childMessage: 'I am stuck.'
    })
  }));
  const body = await response.json();
  assert.strictEqual(response.status, 200, 'teacher API returns 200');
  assert.strictEqual(body.ok, true, 'teacher API returns ok');
  assert.strictEqual(body.raw.included, false, 'teacher API strips raw internals');
  assert.strictEqual(body.deviceModel.childIndependentAccountRequired, false, 'teacher API preserves parent-device model');
  assert(body.handoff && body.handoff.nextBestAction, 'teacher API returns next best action');

  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-teacher', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ childAlias: 'Kid' })
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 400, 'teacher API rejects missing family name');
  assert.strictEqual(bad.error, 'family_name_required', 'teacher API uses stable error code');

  const vercelRes = createMockRes();
  await mod.default({
    method: 'POST',
    url: '/api/lobster-teacher',
    headers: { host: 'yuandianzhixue.com' },
    body: {
      familyName: 'Vercel family',
      childAlias: 'Kid',
      parentObservation: 'The child is stuck.',
      childMessage: 'I do not know the first step.'
    }
  }, vercelRes);
  assert.strictEqual(vercelRes.statusCode, 200, 'teacher API writes Vercel response');
  assert.strictEqual(vercelRes.body.ok, true, 'teacher Vercel response returns ok');
  assert.strictEqual(vercelRes.body.raw.included, false, 'teacher Vercel response strips raw internals');

  const shell = fs.readFileSync(path.join(__dirname, '..', 'lobster.html'), 'utf8');
  assert(shell.includes('/api/lobster-teacher'), 'standalone shell calls unified teacher API');
  assert(shell.includes('家长设备'), 'standalone shell is parent-device first');
  assert(shell.includes('孩子共屏') || shell.includes('共屏使用'), 'standalone shell exposes child co-view mode');
  assert(shell.includes('孩子不需要独立账号'), 'standalone shell makes child account requirement visible');

  console.log('Lobster teacher tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
