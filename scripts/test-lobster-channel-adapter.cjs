#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const adapter = require('../src/lobster/lobster-channel-adapter.cjs');

(async () => {
  const adapters = adapter.listChannelAdapters();
  assert(adapters.some((item) => item.id === 'feishu' && item.officialOnly), 'feishu adapter is listed as official-only');
  assert(adapters.some((item) => item.id === 'dingtalk' && item.officialOnly), 'dingtalk adapter is listed as official-only');
  assert(adapters.some((item) => item.id === 'wechat_future'), 'wechat is explicitly deferred');

  const feishuVerify = adapter.normalizeInboundMessage('feishu', {
    type: 'url_verification',
    challenge: 'verify-token'
  });
  const verifyResponse = adapter.buildChannelResponse(feishuVerify);
  assert.strictEqual(verifyResponse.verification, true, 'feishu url verification is handled');
  assert.strictEqual(verifyResponse.response.challenge, 'verify-token', 'feishu challenge is echoed');

  const feishuInbound = adapter.normalizeInboundMessage('feishu', {
    event: {
      sender: { sender_id: { open_id: 'ou_xxx' } },
      message: {
        message_id: 'om_1',
        chat_id: 'oc_1',
        content: JSON.stringify({ text: '数学 82 分，应用题容易卡住，今晚怎么陪？' })
      }
    }
  });
  assert.strictEqual(feishuInbound.channel, 'feishu', 'feishu inbound channel is normalized');
  assert.strictEqual(feishuInbound.role, 'parent', 'feishu parent message is detected');
  const feishuResponse = adapter.buildChannelResponse(feishuInbound);
  assert.strictEqual(feishuResponse.ok, true, 'feishu channel response succeeds');
  assert.strictEqual(feishuResponse.senderIdStored, false, 'feishu response does not store sender id');
  assert.strictEqual(feishuResponse.rawDialogueStored, false, 'feishu response does not store raw dialogue');
  assert(feishuResponse.replyText.includes('家长龙虾'), 'feishu parent reply is formatted');
  assert.strictEqual(feishuResponse.platformReply.msg_type, 'text', 'feishu platform reply uses text message');
  assert.strictEqual(feishuResponse.sendPlan.channel, 'feishu', 'feishu send plan is returned');
  assert.strictEqual(feishuResponse.sendPlan.dryRun, true, 'feishu send plan is dry-run by default');

  const dingInbound = adapter.normalizeInboundMessage('dingtalk', {
    msgtype: 'text',
    conversationId: 'cid-1',
    senderStaffId: 'staff-1',
    text: { content: '我不会第一步' }
  });
  assert.strictEqual(dingInbound.channel, 'dingtalk', 'dingtalk inbound channel is normalized');
  assert.strictEqual(dingInbound.role, 'child', 'dingtalk child message is detected');
  const dingResponse = adapter.buildChannelResponse(dingInbound);
  assert.strictEqual(dingResponse.ok, true, 'dingtalk channel response succeeds');
  assert.strictEqual(dingResponse.lobster.noFinalAnswer, true, 'dingtalk child reply preserves no-final-answer boundary');
  assert(dingResponse.replyText.includes('孩子龙虾'), 'dingtalk child reply is formatted');
  assert.strictEqual(dingResponse.platformReply.msgtype, 'text', 'dingtalk platform reply uses text message');
  assert.strictEqual(dingResponse.sendPlan.channel, 'dingtalk', 'dingtalk send plan is returned');

  const webhookMod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-message.js')).href);
  const webhookResponse = await webhookMod.default(new Request('https://yuandianzhixue.com/api/lobster-message?mode=channel&channel=feishu', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: {
        message: {
          message_id: 'om_2',
          chat_id: 'oc_2',
          content: JSON.stringify({ text: '数学 82 分，错题很多' })
        }
      }
    })
  }));
  const webhookBody = await webhookResponse.json();
  assert.strictEqual(webhookResponse.status, 200, 'webhook API returns 200');
  assert.strictEqual(webhookBody.schema_id, 'lobster_channel_response_v1', 'webhook API returns stable schema');
  assert.strictEqual(webhookBody.channel, 'feishu', 'webhook API routes feishu channel');

  const sendResponse = await webhookMod.default(new Request('https://yuandianzhixue.com/api/lobster-message?mode=channel&action=send_plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      channel: 'dingtalk',
      conversationId: 'cid-1',
      text: '今晚先说第一步。'
    })
  }));
  const sendBody = await sendResponse.json();
  assert.strictEqual(sendResponse.status, 200, 'send API returns 200');
  assert.strictEqual(sendBody.schema_id, 'lobster_channel_send_v1', 'send API returns stable schema');
  assert.strictEqual(sendBody.tokenExposed, false, 'send API never exposes token');
  assert.strictEqual(sendBody.sent, false, 'send API stays dry-run until official token config');
  assert.strictEqual(sendBody.plan.channel, 'dingtalk', 'send API returns dingtalk plan');

  const shell = fs.readFileSync(path.join(__dirname, '..', 'lobster.html'), 'utf8');
  [
    '飞书机器人',
    '钉钉机器人',
    '微信后续官方适配',
    '/api/lobster-message?mode=channel&channel=feishu',
    '/api/lobster-message?mode=channel&channel=dingtalk',
    '/api/lobster-message?mode=channel&action=send_plan'
  ].forEach((snippet) => {
    assert(shell.includes(snippet), `lobster shell includes ${snippet}`);
  });

  console.log('Lobster channel adapter tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
