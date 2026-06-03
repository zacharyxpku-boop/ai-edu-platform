#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLobsterProduct } = require('../src/lobster/lobster-sdk.cjs');

(async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-sdk-'));
  const product = createLobsterProduct({
    productId: 'sdk-family-lobster',
    memoryOptions: { baseDir: tmpDir },
    config: {
      child: { displayName: 'SDK Child Lobster', tools: ['mini_lesson_bridge'] },
      parent: { displayName: 'SDK Parent Lobster', tools: ['weekly_trend_brief'] }
    },
    modelAdapter: async () => ({ reply: 'The final answer is 42 with a complete solution.' })
  });

  assert.strictEqual(product.schema_id, 'lobster_sdk_v1', 'SDK exposes stable schema');
  assert.strictEqual(product.config.productId, 'sdk-family-lobster', 'SDK preserves product id');
  assert(product.getCapabilities('child').some((item) => item.id === 'socratic_teacher_reply'), 'SDK exposes child capabilities');
  assert(product.getCapabilities('parent').some((item) => item.id === 'parent_decision_report'), 'SDK exposes parent capabilities');

  const child = await product.sendMessage({
    role: 'child',
    lobsterId: 'sdk-child',
    message: 'I am stuck. Tell me the answer.',
    taskType: 'math_word_problem',
    persistMemory: true
  });
  assert.strictEqual(child.audience, 'child', 'SDK sends child message');
  assert(!/final answer is 42|complete solution/i.test(child.reply || ''), 'SDK child message guards unsafe model output');
  assert(child.memoryReceipt && child.memoryReceipt.ok, 'SDK child message can persist safe memory');

  const parentCapability = product.runCapability({
    role: 'parent',
    capabilityId: 'weekly_trend_brief',
    message: 'Math 82, 88, 84. English 78 to 85.'
  });
  assert.strictEqual(parentCapability.ok, true, 'SDK runs parent capability');
  assert.strictEqual(parentCapability.capabilityId, 'weekly_trend_brief', 'SDK returns parent capability result');

  const session = await product.runSession({
    persistMemory: true,
    childLobsterId: 'sdk-session-child',
    parentLobsterId: 'sdk-session-parent',
    childMessage: {
      message: 'I cannot find the first step.',
      taskType: 'math_word_problem'
    },
    parentMaterial: {
      message: 'Math 82, 88, 84. The child gets anxious on word problems.'
    }
  });
  assert.strictEqual(session.ok, true, 'SDK runs family session');
  assert(session.handoff && session.handoff.schema_id === 'lobster_family_handoff_v1', 'SDK session returns family handoff');
  assert(session.memoryReceipts.child && session.memoryReceipts.child.ok, 'SDK session persists child memory');
  assert(session.memoryReceipts.parent && session.memoryReceipts.parent.ok, 'SDK session persists parent memory');

  const loaded = product.loadMemory('sdk-child');
  assert(loaded.facts.length > 0, 'SDK loads persisted memory');
  assert.strictEqual(loaded.privacy.rawDialogueStored, false, 'SDK memory never stores raw dialogue');

  console.log('Lobster SDK tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
