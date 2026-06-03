#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-message.js')).href);
  assert.strictEqual(typeof mod.default, 'function', 'lobster API exports a handler');

  const childResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'child',
      message: '这题我不会，直接告诉我答案',
      taskType: 'math_word_problem'
    })
  }));
  const child = await childResponse.json();
  assert.strictEqual(childResponse.status, 200, 'child lobster API returns 200');
  assert.strictEqual(child.ok, true, 'child lobster API returns ok');
  assert.strictEqual(child.audience, 'child', 'child lobster API routes to child agent');
  assert(child.teacherMode && child.teacherMode.noFinalAnswer, 'child API preserves no-final-answer teacher mode');
  assert(!/答案是|完整解法|最终答案/.test(child.reply || ''), 'child API does not expose direct answer');
  assert(child.raw && child.raw.included === false, 'API strips raw internal engine details');

  const parentResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'parent',
      message: '数学 82、88、84，英语 78 到 85。孩子遇到应用题会急，不知道第一步。',
      parentObservation: '想知道今晚先做什么，不想给孩子增加压力。'
    })
  }));
  const parent = await parentResponse.json();
  assert.strictEqual(parentResponse.status, 200, 'parent lobster API returns 200');
  assert.strictEqual(parent.ok, true, 'parent lobster API returns ok');
  assert.strictEqual(parent.audience, 'parent', 'parent lobster API routes to parent agent');
  assert(parent.summary && parent.summary.oneSentenceDecision, 'parent API returns report summary');
  assert(parent.safety && parent.safety.noGuaranteedImprovement, 'parent API blocks guaranteed improvement');
  assert(parent.raw && parent.raw.included === false, 'parent API strips raw report internals');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-api-memory-'));
  const memoryResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'child',
      lobsterId: 'api-kid',
      message: 'I do not know the first step.',
      taskType: 'math_word_problem',
      persistMemory: true,
      memoryOptions: { baseDir: tmpDir }
    })
  }));
  const memoryBody = await memoryResponse.json();
  assert.strictEqual(memoryResponse.status, 200, 'memory API request returns 200');
  assert(memoryBody.memoryReceipt && memoryBody.memoryReceipt.ok, 'memory API returns persistence receipt');
  assert.strictEqual(memoryBody.memoryReceipt.rawDialogueStored, false, 'memory API never stores raw dialogue');
  assert(fs.existsSync(path.join(tmpDir, 'api-kid.json')), 'memory API writes safe memory file for lobster id');

  const providerFallbackResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'child',
      message: 'I am stuck. What is the first step?',
      taskType: 'math_word_problem',
      useServerModel: true,
      modelProvider: 'openai'
    })
  }));
  const providerFallback = await providerFallbackResponse.json();
  assert.strictEqual(providerFallbackResponse.status, 200, 'provider fallback request returns 200 without local key requirement');
  assert.strictEqual(providerFallback.provider.requested, true, 'provider fallback records requested provider');
  assert.strictEqual(providerFallback.provider.keyExposed, false, 'provider fallback never exposes provider key');
  assert(!JSON.stringify(providerFallback).includes('OPENAI_API_KEY'), 'provider fallback response does not leak env key name');
  assert(providerFallback.reply, 'provider fallback still returns local lobster reply');

  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'child', message: '' })
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 400, 'empty messages are rejected');
  assert.strictEqual(bad.error, 'message_required', 'empty message gets stable error code');

  console.log('Lobster API tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
