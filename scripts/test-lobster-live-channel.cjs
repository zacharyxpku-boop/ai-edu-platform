#!/usr/bin/env node
'use strict';

const assert = require('assert');

const originArg = process.argv.slice(2).find((arg) => arg && !arg.startsWith('--'));
const origin = (process.env.LOBSTER_LIVE_ORIGIN || originArg || 'https://yuandianzhixue.com').replace(/\/$/, '');
const strictRoot = process.argv.includes('--strict-root') || process.env.LOBSTER_LIVE_STRICT_ROOT === '1';

function withBust(path) {
  const mark = path.includes('?') ? '&' : '?';
  return `${origin}${path}${mark}v=lobster-live-${Date.now()}`;
}

async function readText(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      ...(options.headers || {})
    },
    ...options
  });
  const text = await response.text();
  return {
    response,
    text,
    cache: response.headers.get('cf-cache-status') || response.headers.get('x-vercel-cache') || ''
  };
}

async function postJson(path, body) {
  const { response, text } = await readText(`${origin}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} did not return JSON: ${text.slice(0, 160)}`);
  }
  assert(response.ok, `${path} returned HTTP ${response.status}`);
  return json;
}

async function checkPages() {
  const root = await readText(`${origin}/`);
  const bustedRoot = await readText(withBust('/'));
  const lobster = await readText(withBust('/lobster.html'));

  const rootFresh = root.text.includes('家庭 AI 学习系统') && root.text.includes('龙虾 AI 教师');
  if (!rootFresh) {
    const message = `root homepage still looks stale; cache=${root.cache || 'unknown'}`;
    if (strictRoot) throw new Error(message);
    console.warn(`WARN ${message}`);
  }

  assert(bustedRoot.response.ok, 'cache-busted homepage returns 200');
  assert(bustedRoot.text.includes('家庭 AI 学习系统'), 'cache-busted homepage shows official product positioning');
  assert(bustedRoot.text.includes('龙虾 AI 教师'), 'cache-busted homepage links lobster product');
  assert(lobster.response.ok, 'lobster page returns 200');
  ['龙虾 AI 教师', '飞书机器人', '钉钉机器人', '微信后续官方适配', '不做个人号'].forEach((snippet) => {
    assert(lobster.text.includes(snippet), `lobster page includes ${snippet}`);
  });

  console.log(JSON.stringify({
    check: 'pages',
    rootFresh,
    rootCache: root.cache,
    cacheBustedRoot: true,
    lobsterPage: true
  }));
}

async function checkChannels() {
  const feishu = await postJson('/api/lobster-message?mode=channel&channel=feishu', {
    event: {
      message: {
        message_id: 'om_live_contract',
        chat_id: 'oc_live_contract',
        content: JSON.stringify({ text: '数学82分，应用题容易卡住，今晚怎么陪？' })
      }
    }
  });
  assert.strictEqual(feishu.schema_id, 'lobster_channel_response_v1', 'feishu returns channel schema');
  assert.strictEqual(feishu.channel, 'feishu', 'feishu channel is preserved');
  assert.strictEqual(feishu.role, 'parent', 'feishu parent role is detected');
  assert(feishu.replyText.includes('家长龙虾'), 'feishu reply is parent lobster');
  assert.strictEqual(feishu.senderIdStored, false, 'feishu does not store sender id');
  assert.strictEqual(feishu.rawDialogueStored, false, 'feishu does not store raw dialogue');

  const dingtalk = await postJson('/api/lobster-message?mode=channel&channel=dingtalk', {
    msgtype: 'text',
    conversationId: 'cid_live_contract',
    text: { content: '我不会第一步' }
  });
  assert.strictEqual(dingtalk.schema_id, 'lobster_channel_response_v1', 'dingtalk returns channel schema');
  assert.strictEqual(dingtalk.channel, 'dingtalk', 'dingtalk channel is preserved');
  assert.strictEqual(dingtalk.role, 'child', 'dingtalk child role is detected');
  assert(dingtalk.replyText.includes('孩子龙虾'), 'dingtalk reply is child lobster');
  assert.strictEqual(dingtalk.lobster.noFinalAnswer, true, 'child lobster does not give final answer');

  const sendPlan = await postJson('/api/lobster-message?mode=channel&action=send_plan', {
    channel: 'feishu',
    conversationId: 'oc_live_contract',
    text: '今晚先说第一步。'
  });
  assert.strictEqual(sendPlan.schema_id, 'lobster_channel_send_v1', 'send plan returns stable schema');
  assert.strictEqual(sendPlan.channel, 'feishu', 'send plan keeps channel');
  assert.strictEqual(sendPlan.tokenExposed, false, 'send plan never exposes token');
  assert.strictEqual(sendPlan.sent, false, 'send plan stays dry-run without host token');
  assert.strictEqual(sendPlan.plan.readyToSend, true, 'send plan is ready once host token is configured');

  console.log(JSON.stringify({
    check: 'channels',
    feishu: true,
    dingtalk: true,
    sendPlan: true
  }));
}

(async () => {
  await checkPages();
  await checkChannels();
  console.log(`Lobster live channel check passed for ${origin}.`);
})().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
