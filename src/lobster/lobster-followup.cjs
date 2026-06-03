'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const teacher = require('./lobster-teacher.cjs');

const root = path.join(__dirname, '..', '..');

function asText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function safeId(value, fallback = 'family') {
  return asText(value || fallback)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || fallback;
}

function followUpBaseDir(options = {}) {
  if (options.baseDir) return options.baseDir;
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'lobster-followups');
  return path.join(root, 'outputs', 'lobster-followups');
}

function followUpPath(familyId, options = {}) {
  return path.join(followUpBaseDir(options), `${safeId(familyId)}.json`);
}

function stableDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function buildDueAt(reminder = {}, input = {}) {
  const now = new Date(input.now || input.createdAt || Date.now());
  const time = asText(reminder.time);
  if (/next_day_after_school/i.test(time)) {
    const due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(17, 30, 0, 0);
    return due.toISOString();
  }
  if (/sunday_evening/i.test(time)) {
    const due = new Date(now);
    const day = due.getDay();
    const add = (7 - day) % 7 || 7;
    due.setDate(due.getDate() + add);
    due.setHours(20, 0, 0, 0);
    return due.toISOString();
  }
  const clock = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (clock) {
    const due = new Date(now);
    due.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
    if (due.getTime() < now.getTime()) due.setDate(due.getDate() + 1);
    return due.toISOString();
  }
  return now.toISOString();
}

function normalizeReminder(reminder = {}, input = {}) {
  const id = safeId(reminder.id || reminder.title || 'followup', 'followup');
  return {
    id,
    title: asText(reminder.title) || id,
    action: asText(reminder.action) || 'Check the next learning evidence.',
    channel: asText(reminder.channel) || 'parent_device',
    dueAt: buildDueAt(reminder, input),
    payload: safeId(reminder.payload || id, id),
    status: 'scheduled',
    createdAt: stableDate(input.createdAt || input.now),
    completedAt: ''
  };
}

function createFollowUpSchedule(input = {}) {
  const workspace = input.workspace || teacher.buildUnifiedTeacherWorkspace(input);
  const familyId = safeId(input.familyId || workspace.activationId || input.familyName, 'lobster-family');
  const plan = workspace.modes && workspace.modes.teacherPresence
    ? workspace.modes.teacherPresence.proactiveFollowUp
    : teacher.buildFollowUpPlan(input, {});
  const reminders = (plan.reminders || []).map((reminder) => normalizeReminder(reminder, input));
  return {
    ok: true,
    schema_id: 'lobster_followup_schedule_v1',
    familyId,
    activationId: workspace.activationId || '',
    productName: workspace.productName || 'Lobster AI Teacher',
    cadence: plan.cadence || 'daily_light_touch_plus_weekly_report',
    reminders,
    evidenceQueue: Array.isArray(plan.evidenceQueue) ? plan.evidenceQueue.slice(0, 8) : [],
    events: [],
    safety: {
      parentDeviceDeliveryFirst: true,
      externalChannelAdaptersOptional: true,
      rawDialogueStored: false,
      storesContactFields: false
    },
    updatedAt: stableDate(input.createdAt || input.now)
  };
}

function saveFollowUpSchedule(schedule = {}, options = {}) {
  const familyId = safeId(schedule.familyId || schedule.activationId, 'lobster-family');
  const file = followUpPath(familyId, options);
  const next = Object.assign({}, schedule, {
    familyId,
    updatedAt: stableDate(options.now || schedule.updatedAt)
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(next, null, 2));
  return {
    ok: true,
    familyId,
    schedulePath: file,
    reminderCount: Array.isArray(next.reminders) ? next.reminders.length : 0,
    rawDialogueStored: false
  };
}

function loadFollowUpSchedule(familyId, options = {}) {
  const file = followUpPath(familyId, options);
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      schema_id: 'lobster_followup_schedule_v1',
      familyId: safeId(familyId),
      reminders: [],
      events: [],
      error: 'followup_schedule_not_found'
    };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Object.assign({ ok: true }, parsed, {
      safety: Object.assign({
        parentDeviceDeliveryFirst: true,
        externalChannelAdaptersOptional: true,
        rawDialogueStored: false,
        storesContactFields: false
      }, parsed.safety || {})
    });
  } catch (_) {
    return {
      ok: false,
      schema_id: 'lobster_followup_schedule_v1',
      familyId: safeId(familyId),
      reminders: [],
      events: [],
      error: 'followup_schedule_invalid'
    };
  }
}

function listDueFollowUps(schedule = {}, now = new Date().toISOString()) {
  const cutoff = new Date(now).getTime();
  return (Array.isArray(schedule.reminders) ? schedule.reminders : [])
    .filter((item) => item && item.status === 'scheduled')
    .filter((item) => new Date(item.dueAt).getTime() <= cutoff)
    .map((item) => ({
      id: item.id,
      title: item.title,
      action: item.action,
      channel: item.channel,
      dueAt: item.dueAt,
      payload: item.payload
    }));
}

function recordFollowUpEvent(familyId, event = {}, options = {}) {
  const current = loadFollowUpSchedule(familyId, options);
  if (!current.ok) return current;
  const reminderId = safeId(event.reminderId || event.id || 'followup');
  const status = asText(event.status) || 'completed';
  const updated = Object.assign({}, current, {
    reminders: (current.reminders || []).map((item) => {
      if (item.id !== reminderId) return item;
      return Object.assign({}, item, {
        status,
        completedAt: status === 'completed' ? stableDate(options.now || event.createdAt) : item.completedAt || ''
      });
    }),
    events: (current.events || []).concat({
      reminderId,
      status,
      note: asText(event.note).slice(0, 220),
      createdAt: stableDate(options.now || event.createdAt)
    }).slice(-80),
    updatedAt: stableDate(options.now || event.createdAt)
  });
  saveFollowUpSchedule(updated, options);
  return {
    ok: true,
    familyId: updated.familyId,
    reminderId,
    status,
    due: listDueFollowUps(updated, options.now || new Date().toISOString()),
    rawDialogueStored: false
  };
}

function recordDispatchAttempt(familyId, attempt = {}, options = {}) {
  const current = loadFollowUpSchedule(familyId, options);
  if (!current.ok) return current;
  const reminderId = safeId(attempt.reminderId || attempt.id || 'followup');
  const status = asText(attempt.status) || 'dispatched';
  const channel = asText(attempt.channel) || 'parent_device';
  const updated = Object.assign({}, current, {
    reminders: (current.reminders || []).map((item) => {
      if (item.id !== reminderId) return item;
      return Object.assign({}, item, {
        status,
        dispatchStatus: status,
        dispatchedAt: stableDate(options.now || attempt.createdAt)
      });
    }),
    dispatchReceipts: (current.dispatchReceipts || []).concat({
      reminderId,
      status,
      channel,
      adapter: safeId(attempt.adapter || 'manual-parent-device', 'manual-parent-device'),
      createdAt: stableDate(options.now || attempt.createdAt),
      contactFieldsStored: false,
      rawDialogueStored: false
    }).slice(-80),
    events: (current.events || []).concat({
      reminderId,
      status,
      note: asText(attempt.note || 'Dispatch attempt recorded.').slice(0, 220),
      createdAt: stableDate(options.now || attempt.createdAt)
    }).slice(-80),
    updatedAt: stableDate(options.now || attempt.createdAt)
  });
  saveFollowUpSchedule(updated, options);
  return {
    ok: true,
    familyId: updated.familyId,
    reminderId,
    status,
    channel,
    dispatchSideEffects: false,
    contactFieldsStored: false,
    rawDialogueStored: false
  };
}

function inboxActionForPayload(payload = '') {
  const id = safeId(payload, 'followup');
  if (/weekly/i.test(id)) return 'open_parent_weekly_report';
  if (/revisit|review/i.test(id)) return 'open_short_revisit';
  if (/co-view|co_view|child/i.test(id)) return 'open_child_co_view';
  return 'open_parent_teacher_workspace';
}

function buildParentDeviceInbox(options = {}) {
  const scan = scanDueFollowUps(options);
  const items = (scan.due || []).map((item) => ({
    id: `${safeId(item.familyId)}-${safeId(item.id)}`,
    familyId: item.familyId,
    activationId: item.activationId || '',
    reminderId: item.id,
    title: item.title,
    action: item.action,
    channel: 'parent_device',
    dueAt: item.dueAt,
    payload: item.payload,
    cta: inboxActionForPayload(item.payload || item.id),
    url: `/lobster.html?family_id=${encodeURIComponent(item.familyId)}&reminder=${encodeURIComponent(item.id)}`,
    status: 'ready'
  }));
  return {
    ok: true,
    schema_id: 'lobster_parent_device_inbox_v1',
    now: scan.now,
    itemCount: items.length,
    items,
    source: {
      schema_id: scan.schema_id,
      familyCount: scan.familyCount,
      dueCount: scan.dueCount,
      errors: scan.errors || []
    },
    safety: {
      parentDeviceDeliveryFirst: true,
      rawDialogueReturned: false,
      contactFieldsReturned: false,
      dispatchSideEffects: false
    }
  };
}

function materializeParentDeviceInbox(options = {}) {
  const inbox = buildParentDeviceInbox(options);
  const receipts = inbox.items.map((item) => recordDispatchAttempt(item.familyId, {
    reminderId: item.reminderId,
    status: 'inbox_ready',
    channel: 'parent_device',
    adapter: options.adapter || 'parent-device-inbox',
    note: 'Parent-device inbox item materialized.'
  }, options));
  return Object.assign({}, inbox, {
    materialized: true,
    receipts,
    safety: Object.assign({}, inbox.safety, {
      dispatchSideEffects: false,
      contactFieldsStored: false,
      rawDialogueStored: false
    })
  });
}

function scanDueFollowUps(options = {}) {
  const baseDir = followUpBaseDir(options);
  const now = stableDate(options.now);
  if (!fs.existsSync(baseDir)) {
    return {
      ok: true,
      schema_id: 'lobster_followup_due_scan_v1',
      now,
      baseDir,
      familyCount: 0,
      dueCount: 0,
      due: [],
      errors: [],
      safety: {
        rawDialogueStored: false,
        contactFieldsReturned: false
      }
    };
  }
  const files = fs.readdirSync(baseDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(baseDir, name));
  const due = [];
  const errors = [];
  files.forEach((file) => {
    const familyId = path.basename(file, '.json');
    const schedule = loadFollowUpSchedule(familyId, options);
    if (!schedule.ok) {
      errors.push({ familyId, error: schedule.error || 'followup_schedule_invalid' });
      return;
    }
    listDueFollowUps(schedule, now).forEach((item) => {
      due.push(Object.assign({
        familyId: schedule.familyId,
        activationId: schedule.activationId || '',
        productName: schedule.productName || 'Lobster AI Teacher'
      }, item));
    });
  });
  due.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return {
    ok: true,
    schema_id: 'lobster_followup_due_scan_v1',
    now,
    baseDir,
    familyCount: files.length,
    dueCount: due.length,
    due,
    errors,
    safety: {
      rawDialogueStored: false,
      contactFieldsReturned: false
    }
  };
}

module.exports = {
  createFollowUpSchedule,
  saveFollowUpSchedule,
  loadFollowUpSchedule,
  listDueFollowUps,
  recordFollowUpEvent,
  recordDispatchAttempt,
  buildParentDeviceInbox,
  materializeParentDeviceInbox,
  scanDueFollowUps,
  followUpPath
};
