#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const followup = require('../src/lobster/lobster-followup.cjs');

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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-followup-'));
  const now = '2026-06-03T10:00:00.000Z';
  const schedule = followup.createFollowUpSchedule({
    familyName: 'Followup family',
    childAlias: 'Kid',
    parentObservation: 'The child is anxious before homework.',
    childMessage: 'I do not know the first step.',
    preferredFollowUpTime: '19:30',
    now
  });
  assert.strictEqual(schedule.ok, true, 'follow-up schedule returns ok');
  assert.strictEqual(schedule.schema_id, 'lobster_followup_schedule_v1', 'follow-up schedule has stable schema');
  assert(schedule.reminders.length >= 3, 'follow-up schedule includes daily and weekly reminders');
  assert(schedule.reminders.every((item) => item.channel === 'parent_device'), 'follow-up reminders are parent-device first');
  assert.strictEqual(schedule.safety.rawDialogueStored, false, 'follow-up schedule never stores raw dialogue');

  const receipt = followup.saveFollowUpSchedule(schedule, { baseDir: tmpDir, now });
  assert.strictEqual(receipt.ok, true, 'follow-up schedule persists');
  assert(fs.existsSync(followup.followUpPath(schedule.familyId, { baseDir: tmpDir })), 'follow-up schedule file exists');

  const originalVercel = process.env.VERCEL;
  process.env.VERCEL = '1';
  const vercelPath = followup.followUpPath('vercel-family');
  assert(vercelPath.startsWith(os.tmpdir()), 'Vercel follow-up storage uses tmpdir');
  if (originalVercel == null) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }

  const loaded = followup.loadFollowUpSchedule(schedule.familyId, { baseDir: tmpDir });
  assert.strictEqual(loaded.ok, true, 'follow-up schedule loads');
  assert.strictEqual(loaded.safety.storesContactFields, false, 'loaded schedule does not store contact fields');

  const due = followup.listDueFollowUps(loaded, '2026-06-04T00:00:00.000Z');
  assert(due.some((item) => item.id === 'tonight_first_step'), 'tonight reminder becomes due');

  const eventReceipt = followup.recordFollowUpEvent(schedule.familyId, {
    reminderId: 'tonight_first_step',
    status: 'completed',
    note: 'Child said the first step on parent device.'
  }, { baseDir: tmpDir, now: '2026-06-03T20:05:00.000Z' });
  assert.strictEqual(eventReceipt.ok, true, 'follow-up event is recorded');
  const afterEvent = followup.loadFollowUpSchedule(schedule.familyId, { baseDir: tmpDir });
  assert(afterEvent.events.length === 1, 'follow-up event is appended');
  assert(afterEvent.reminders.find((item) => item.id === 'tonight_first_step').status === 'completed', 'completed reminder status is saved');

  const secondSchedule = followup.createFollowUpSchedule({
    familyName: 'Second family',
    childAlias: 'Kid2',
    preferredFollowUpTime: '18:30',
    now
  });
  followup.saveFollowUpSchedule(secondSchedule, { baseDir: tmpDir, now });
  const scan = followup.scanDueFollowUps({ baseDir: tmpDir, now: '2026-06-04T00:00:00.000Z' });
  assert.strictEqual(scan.ok, true, 'due scanner returns ok');
  assert.strictEqual(scan.schema_id, 'lobster_followup_due_scan_v1', 'due scanner has stable schema');
  assert(scan.familyCount >= 2, 'due scanner reads all saved family schedules');
  assert(scan.due.some((item) => item.familyId === secondSchedule.familyId && item.id === 'tonight_first_step'), 'due scanner includes due reminders across families');
  assert.strictEqual(scan.safety.contactFieldsReturned, false, 'due scanner does not return contact fields');
  assert(!JSON.stringify(scan).includes('phone'), 'due scanner payload does not include contact field names');

  const runner = childProcess.spawnSync(process.execPath, [
    path.join(__dirname, 'lobster-followup-due-runner.cjs'),
    `--baseDir=${tmpDir}`,
    '--now=2026-06-04T00:00:00.000Z'
  ], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  });
  assert.strictEqual(runner.status, 0, 'due runner exits successfully');
  const runnerBody = JSON.parse(runner.stdout);
  assert.strictEqual(runnerBody.schema_id, 'lobster_followup_due_scan_v1', 'due runner prints scan JSON');
  assert(runnerBody.dueCount >= 1, 'due runner reports due reminders');

  const dispatchReceipt = followup.recordDispatchAttempt(secondSchedule.familyId, {
    reminderId: 'tonight_first_step',
    status: 'dispatched',
    channel: 'parent_device',
    adapter: 'manual-parent-device',
    note: 'Parent device reminder was shown.'
  }, { baseDir: tmpDir, now: '2026-06-03T18:31:00.000Z' });
  assert.strictEqual(dispatchReceipt.ok, true, 'dispatch attempt is recorded');
  assert.strictEqual(dispatchReceipt.dispatchSideEffects, false, 'dispatch receipt does not send messages');
  assert.strictEqual(dispatchReceipt.contactFieldsStored, false, 'dispatch receipt stores no contact fields');
  const afterDispatch = followup.loadFollowUpSchedule(secondSchedule.familyId, { baseDir: tmpDir });
  assert(afterDispatch.dispatchReceipts.length === 1, 'dispatch receipt is appended');
  assert.strictEqual(afterDispatch.dispatchReceipts[0].rawDialogueStored, false, 'dispatch receipt stores no raw dialogue');

  const inboxSchedule = followup.createFollowUpSchedule({
    familyName: 'Inbox family',
    childAlias: 'Kid3',
    preferredFollowUpTime: '17:45',
    now
  });
  followup.saveFollowUpSchedule(inboxSchedule, { baseDir: tmpDir, now });
  const inbox = followup.buildParentDeviceInbox({ baseDir: tmpDir, now: '2026-06-04T12:00:00.000Z' });
  assert.strictEqual(inbox.schema_id, 'lobster_parent_device_inbox_v1', 'parent device inbox has stable schema');
  assert(inbox.items.some((item) => item.familyId === inboxSchedule.familyId), 'inbox exposes due reminders as parent-device items');
  assert.strictEqual(inbox.safety.contactFieldsReturned, false, 'inbox returns no contact fields');
  const materialized = followup.materializeParentDeviceInbox({ baseDir: tmpDir, now: '2026-06-04T12:00:00.000Z' });
  assert.strictEqual(materialized.materialized, true, 'inbox can be materialized');
  assert(materialized.receipts.some((item) => item.familyId === inboxSchedule.familyId), 'materialized inbox records dispatch receipts');
  const afterInbox = followup.loadFollowUpSchedule(inboxSchedule.familyId, { baseDir: tmpDir });
  assert(afterInbox.dispatchReceipts.length >= 1, 'inbox materialization appends dispatch receipts');
  assert(afterInbox.reminders.some((item) => item.status === 'inbox_ready'), 'inbox materialization marks reminders ready for parent device');

  const dueMod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-followup-due.js')).href);
  const defaultSchedule = followup.createFollowUpSchedule({
    familyName: 'Due API family',
    childAlias: 'Kid',
    preferredFollowUpTime: '18:00',
    now
  });
  followup.saveFollowUpSchedule(defaultSchedule, { now });
  const dueResponse = await dueMod.default(new Request('https://yuandianzhixue.com/api/lobster-followup-due', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-04T00:00:00.000Z'
    })
  }));
  const dueBody = await dueResponse.json();
  assert.strictEqual(dueResponse.status, 200, 'due API returns 200');
  assert.strictEqual(dueBody.ok, true, 'due API returns ok');
  assert.strictEqual(dueBody.schema_id, 'lobster_followup_due_scan_v1', 'due API returns scan schema');
  assert.strictEqual(dueBody.cron.callable, true, 'due API is callable by cron');
  assert.strictEqual(dueBody.cron.dispatchSideEffects, false, 'due API does not mark reminders as dispatched');
  assert.strictEqual(dueBody.safety.contactFieldsReturned, false, 'due API does not return contact fields');
  fs.rmSync(followup.followUpPath(defaultSchedule.familyId), { force: true });

  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-followup.js')).href);
  const response = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-followup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      familyName: 'API family',
      childAlias: 'Kid',
      parentObservation: 'Homework starts with conflict.',
      now
    })
  }));
  const body = await response.json();
  assert.strictEqual(response.status, 200, 'follow-up API returns 200');
  assert.strictEqual(body.ok, true, 'follow-up API returns ok');
  assert(body.persistence && body.persistence.ok, 'follow-up API persists schedule');
  assert.strictEqual(body.persistence.rawDialogueStored, false, 'follow-up API never stores raw dialogue');
  if (body.familyId) {
    fs.rmSync(followup.followUpPath(body.familyId), { force: true });
  }

  const badResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-followup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }));
  const bad = await badResponse.json();
  assert.strictEqual(badResponse.status, 400, 'follow-up API rejects missing family');
  assert.strictEqual(bad.error, 'family_name_required', 'follow-up API has stable missing-family error');

  const apiSchedule = followup.createFollowUpSchedule({
    familyName: 'Dispatch API family',
    childAlias: 'Kid',
    preferredFollowUpTime: '18:00',
    now
  });
  followup.saveFollowUpSchedule(apiSchedule, { now });
  const dispatchResponse = await mod.default(new Request('https://yuandianzhixue.com/api/lobster-followup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'record_dispatch',
      familyId: apiSchedule.familyId,
      reminderId: 'tonight_first_step',
      status: 'dispatched',
      channel: 'parent_device',
      adapter: 'manual-parent-device'
    })
  }));
  const dispatchBody = await dispatchResponse.json();
  assert.strictEqual(dispatchResponse.status, 200, 'follow-up API records dispatch');
  assert.strictEqual(dispatchBody.ok, true, 'dispatch API returns ok');
  assert.strictEqual(dispatchBody.contactFieldsStored, false, 'dispatch API stores no contact fields');
  fs.rmSync(followup.followUpPath(apiSchedule.familyId), { force: true });

  const inboxMod = await import(pathToFileURL(path.join(__dirname, '..', 'api', 'lobster-followup-inbox.js')).href);
  const apiInboxSchedule = followup.createFollowUpSchedule({
    familyName: 'Inbox API family',
    childAlias: 'Kid',
    preferredFollowUpTime: '18:00',
    now
  });
  followup.saveFollowUpSchedule(apiInboxSchedule, { now });
  const inboxResponse = await inboxMod.default(new Request('https://yuandianzhixue.com/api/lobster-followup-inbox?now=2026-06-04T12:00:00.000Z', {
    method: 'GET'
  }));
  const inboxBody = await inboxResponse.json();
  assert.strictEqual(inboxResponse.status, 200, 'inbox API returns 200');
  assert.strictEqual(inboxBody.schema_id, 'lobster_parent_device_inbox_v1', 'inbox API returns stable schema');
  assert(inboxBody.items.some((item) => item.familyId === apiInboxSchedule.familyId), 'inbox API includes due family item');
  const materializeResponse = await inboxMod.default(new Request('https://yuandianzhixue.com/api/lobster-followup-inbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      now: '2026-06-04T12:00:00.000Z',
      adapter: 'parent-device-inbox'
    })
  }));
  const materializeBody = await materializeResponse.json();
  assert.strictEqual(materializeResponse.status, 200, 'inbox API materializes due items');
  assert.strictEqual(materializeBody.materialized, true, 'inbox API marks materialized payload');
  assert.strictEqual(materializeBody.safety.contactFieldsStored, false, 'inbox API stores no contact fields');
  fs.rmSync(followup.followUpPath(apiInboxSchedule.familyId), { force: true });

  const vercelCreateRes = createMockRes();
  await mod.default({
    method: 'POST',
    url: '/api/lobster-followup',
    headers: { host: 'yuandianzhixue.com' },
    body: {
      familyName: 'Vercel followup family',
      childAlias: 'Kid',
      now
    }
  }, vercelCreateRes);
  assert.strictEqual(vercelCreateRes.statusCode, 200, 'follow-up API writes Vercel response');
  assert.strictEqual(vercelCreateRes.body.ok, true, 'follow-up Vercel response returns ok');
  if (vercelCreateRes.body.familyId) {
    fs.rmSync(followup.followUpPath(vercelCreateRes.body.familyId), { force: true });
  }

  const vercelInboxRes = createMockRes();
  await inboxMod.default({
    method: 'GET',
    url: '/api/lobster-followup-inbox?now=2026-06-04T12:00:00.000Z',
    headers: { host: 'yuandianzhixue.com' }
  }, vercelInboxRes);
  assert.strictEqual(vercelInboxRes.statusCode, 200, 'inbox API writes Vercel response');
  assert.strictEqual(vercelInboxRes.body.schema_id, 'lobster_parent_device_inbox_v1', 'inbox Vercel response returns stable schema');

  console.log('Lobster follow-up tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
