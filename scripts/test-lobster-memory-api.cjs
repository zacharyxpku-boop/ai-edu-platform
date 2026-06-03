#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-memory.js')).href);
  assert.strictEqual(typeof mod.default, 'function', 'lobster memory API exports a handler');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-memory-api-'));
  const postResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-memory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lobsterId: 'memory-kid',
      memoryOptions: { baseDir: tmpDir },
      memoryUpdate: {
        role: 'child',
        facts: [
          { key: 'task_type', text: 'math_word_problem', sourceType: 'test' },
          { key: 'full_dialogue', text: 'unsafe transcript', sourceType: 'test' },
          { key: 'parent_wechat', text: 'unsafe contact', sourceType: 'test' }
        ],
        counters: { child_message: 1 },
        privacy: { rawDialogueStored: false, unsafeFieldsDropped: ['full_dialogue', 'parent_wechat'] }
      }
    })
  }));
  const postBody = await postResponse.json();
  assert.strictEqual(postResponse.status, 200, 'POST memory returns 200');
  assert.strictEqual(postBody.ok, true, 'POST memory returns ok');
  assert.strictEqual(postBody.factCount, 1, 'POST memory stores only safe facts');
  assert(postBody.memory.facts.some((fact) => fact.key === 'task_type'), 'POST memory keeps safe task fact');
  assert(!postBody.memory.facts.some((fact) => /full_dialogue|wechat/i.test(fact.key)), 'POST memory drops unsafe facts');

  const getResponse = await mod.default(new Request(`https://yuandianzhixue.com/api/lobster-memory?lobster_id=memory-kid&base_dir=${encodeURIComponent(tmpDir)}`, {
    method: 'GET'
  }));
  const getBody = await getResponse.json();
  assert.strictEqual(getResponse.status, 200, 'GET memory returns 200');
  assert.strictEqual(getBody.schema_id, 'lobster_memory_v1', 'GET memory returns stable schema');
  assert.strictEqual(getBody.facts.length, 1, 'GET memory returns stored safe facts');
  assert.strictEqual(getBody.privacy.rawDialogueStored, false, 'GET memory confirms raw dialogue is not stored');

  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-memory', {
    method: 'DELETE'
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 405, 'unsupported methods are rejected');
  assert.strictEqual(bad.error, 'method_not_allowed', 'unsupported method has stable error');

  console.log('Lobster memory API tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
