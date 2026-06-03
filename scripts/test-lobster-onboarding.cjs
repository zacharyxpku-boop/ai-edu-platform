#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const onboarding = require('../src/lobster/lobster-onboarding.cjs');

(async () => {
  assert.strictEqual(onboarding.normalizeChildChannel({ childChannel: 'QQ' }), 'qq');
  assert.strictEqual(onboarding.normalizeChildChannel({ childDevice: '小天才手表' }), 'xiaotiancai');
  assert.strictEqual(onboarding.normalizeChildChannel({ deliveryChannel: '飞书' }), 'feishu');
  assert.strictEqual(onboarding.normalizeChildChannel({ deliveryChannel: '钉钉' }), 'dingtalk');
  assert.strictEqual(onboarding.normalizeDeliveryChannel({ parentChannel: '微信' }), 'wechat_future');

  const webPack = onboarding.buildActivationPackage({
    familyName: 'Chen family',
    childAlias: 'Ming',
    gradeBand: 'grade 5',
    subjects: 'math, english',
    parentGoal: 'reduce homework conflict',
    childNeed: 'word problem first step',
    childChannel: 'tablet web'
  });
  assert.strictEqual(webPack.ok, true, 'activation package returns ok');
  assert.strictEqual(webPack.schema_id, 'lobster_activation_v1', 'activation package has stable schema');
  assert(webPack.activationId.startsWith('lobster-'), 'activation id is generated');
  assert(webPack.userCanFindProductAt.primary.includes('lobster.html'), 'package tells user where to find product');
  assert.strictEqual(webPack.configuration.childChannel.channel, 'web-h5', 'web child channel is ready');
  assert.strictEqual(webPack.configuration.childChannel.status, 'ready_for_mvp', 'web child channel is MVP-ready');
  assert.strictEqual(webPack.configuration.parentChannel.channel, 'web-parent-device', 'parent channel defaults to web parent device');
  assert.strictEqual(webPack.configuration.parentChannel.status, 'ready_for_mvp', 'web parent channel is MVP-ready');
  assert.strictEqual(webPack.safety.channelAdaptersUseOfficialRoutesOnly, true, 'channel safety boundary is present');
  assert.strictEqual(webPack.lobsterConfig.child.audience, 'child', 'child lobster config is included');
  assert.strictEqual(webPack.lobsterConfig.parent.audience, 'parent', 'parent lobster config is included');

  const feishuPack = onboarding.buildActivationPackage({
    familyName: 'Feishu pilot',
    deliveryChannel: 'feishu',
    childChannel: 'feishu'
  });
  assert.strictEqual(feishuPack.configuration.parentChannel.channel, 'feishu-official-bot', 'feishu parent channel is official bot');
  assert.strictEqual(feishuPack.configuration.childChannel.channel, 'feishu-official-bot', 'feishu child channel is official bot');
  assert.strictEqual(feishuPack.configuration.parentChannel.webhook, '/api/lobster-message?mode=channel&channel=feishu', 'feishu package exposes webhook');
  assert.strictEqual(feishuPack.configuration.parentChannel.boundary.officialBotOnly, true, 'feishu package forbids unofficial bot route');

  const dingPack = onboarding.buildActivationPackage({
    familyName: 'Ding pilot',
    deliveryChannel: 'dingtalk',
    childChannel: 'dingtalk'
  });
  assert.strictEqual(dingPack.configuration.parentChannel.channel, 'dingtalk-official-bot', 'dingtalk parent channel is official bot');
  assert.strictEqual(dingPack.configuration.childChannel.channel, 'dingtalk-official-bot', 'dingtalk child channel is official bot');
  assert.strictEqual(dingPack.configuration.parentChannel.webhook, '/api/lobster-message?mode=channel&channel=dingtalk', 'dingtalk package exposes webhook');
  assert.strictEqual(dingPack.configuration.parentChannel.boundary.officialBotOnly, true, 'dingtalk package forbids unofficial bot route');

  const wechatPack = onboarding.buildActivationPackage({
    familyName: 'Wechat future',
    deliveryChannel: 'wechat'
  });
  assert.strictEqual(wechatPack.configuration.parentChannel.channel, 'wechat-official-adapter-deferred', 'wechat is deferred to official adapter');
  assert.strictEqual(wechatPack.configuration.parentChannel.status, 'deferred_until_official_wechat_flow', 'wechat is not promised as current bot loop');
  assert.strictEqual(wechatPack.configuration.parentChannel.boundary.noPersonalWechatBot, true, 'wechat package forbids personal bot');

  const qqPack = onboarding.buildActivationPackage({
    familyName: 'QQ pilot',
    childChannel: 'QQ'
  });
  assert.strictEqual(qqPack.configuration.childChannel.channel, 'qq-official-bot', 'QQ is mapped to official bot channel');
  assert.strictEqual(qqPack.configuration.childChannel.boundary.noUnofficialQQProtocol, true, 'QQ package forbids unofficial protocol');

  const watchPack = onboarding.buildActivationPackage({
    familyName: 'Watch pilot',
    childDevice: '小天才电话手表'
  });
  assert.strictEqual(watchPack.configuration.childChannel.channel, 'xiaotiancai-open-platform', 'watch is mapped to open platform');
  assert.strictEqual(watchPack.configuration.childChannel.status, 'partner_review_required', 'watch channel is not over-promised');

  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-onboarding.js')).href);
  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ childAlias: 'Kid' })
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 400, 'onboarding rejects missing family name');
  assert.strictEqual(bad.error, 'family_name_required', 'onboarding has stable missing-family error');

  const response = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-onboarding', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      familyName: 'Pilot family',
      childAlias: 'Kid',
      deliveryChannel: 'feishu'
    })
  }));
  const body = await response.json();
  assert.strictEqual(response.status, 200, 'onboarding API returns 200');
  assert.strictEqual(body.ok, true, 'onboarding API returns ok');
  assert(body.shareKit && body.shareKit.salesLine.includes('飞书/钉钉'), 'onboarding API returns current distribution line');

  const page = fs.readFileSync(path.join(__dirname, '..', 'lobster.html'), 'utf8');
  assert(page.includes('id="lobster-config-form"'), 'static product entry has a configuration form');
  assert(page.includes('data-channel="feishu"'), 'static product entry explains Feishu route');
  assert(page.includes('data-channel="dingtalk"'), 'static product entry explains DingTalk route');
  assert(page.includes('data-channel="wechat_future"'), 'static product entry defers WeChat route');
  assert(page.includes('/api/lobster-teacher'), 'static product entry calls unified teacher API when available');
  assert(page.includes('/api/lobster-message?mode=channel&channel=feishu'), 'static product entry shows Feishu webhook');
  assert(page.includes('/api/lobster-message?mode=channel&channel=dingtalk'), 'static product entry shows DingTalk webhook');
  assert(page.includes('/api/lobster-message?mode=channel&action=send_plan'), 'static product entry shows send plan API');

  console.log('Lobster onboarding tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
