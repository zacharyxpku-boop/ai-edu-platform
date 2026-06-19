#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function callGet(rel, query = '') {
  const mod = await import(pathToFileURL(path.join(root, rel)).href);
  const res = await mod.default(new Request(`https://qa.local/${rel}${query}`, { method: 'GET' }));
  let body = {};
  try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

async function callPost(rel, body = {}) {
  const mod = await import(pathToFileURL(path.join(root, rel)).href);
  const res = await mod.default(new Request(`https://qa.local/${rel}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }));
  let parsed = {};
  try { parsed = await res.json(); } catch (_) {}
  return { status: res.status, body: parsed };
}

(async () => {
  const migration = read('supabase/migrations/20260613_enable_rls.sql');
  assert(migration.includes('alter table public.student_states enable row level security'), 'student_states RLS migration is present');
  assert(migration.includes('alter table public.questions enable row level security'), 'questions RLS migration is present');
  const uncommentedQuestionPolicies = migration
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--') && line.includes('public.questions') && line.includes(' to anon '));
  assert.strictEqual(uncommentedQuestionPolicies.length, 0, 'questions anon read policy remains commented out');

  const hardening = read('supabase/migrations/20260614_harden_rls_after_poc.sql');
  [
    'drop policy if exists "PoC 期间 anon 可读 students 用于 student_id 路由"',
    'drop policy if exists "PoC 期间 anon 可读 student_states"',
    'drop policy if exists "公共题目所有人可读"',
    'drop policy if exists "anon_read_questions"',
    'drop policy if exists "学生写题日志（anon allow insert）"',
    'drop policy if exists "对话日志可写"'
  ].forEach((marker) => {
    assert(hardening.includes(marker), `hardening migration drops PoC policy: ${marker}`);
  });
  assert(hardening.includes('attempts_server_insert_only') && hardening.includes('with check (false)'), 'hardening migration denies anon attempts insert');
  assert(hardening.includes('dialogues_server_insert_only') && hardening.includes('with check (false)'), 'hardening migration denies anon dialogues insert');

  const persistence = read('supabase/migrations/20260614_mini_learning_persistence.sql');
  assert(persistence.includes('create table if not exists public.mini_learning_events'), 'mini persistence migration creates events table');
  assert(persistence.includes('create table if not exists public.family_priority_feedback'), 'mini persistence migration creates feedback table');
  assert(persistence.includes('alter table public.mini_learning_events enable row level security'), 'mini persistence migration enables events RLS');
  assert(persistence.includes('alter table public.family_priority_feedback enable row level security'), 'mini persistence migration enables feedback RLS');

  const getQuestions = read('api/get-questions.js');
  assert(getQuestions.includes('SUPABASE_SERVICE_ROLE_KEY'), 'get-questions uses service role env');
  assert(!getQuestions.includes('SUPABASE_ANON_KEY'), 'get-questions must not use anon key after questions RLS');
  assert(getQuestions.includes("'apikey': SUPABASE_SERVICE_KEY"), 'get-questions sends service key as apikey');
  assert(getQuestions.includes("'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY"), 'get-questions sends service key bearer token');
  assert(getQuestions.includes('questions?or=('), 'get-questions still reads the questions table through the server');

  const fsrsDue = read('api/fsrs-due.js');
  assert(fsrsDue.includes('SUPABASE_SERVICE_ROLE_KEY'), 'fsrs-due uses service role env');
  assert(!fsrsDue.includes('SUPABASE_ANON_KEY'), 'fsrs-due must not use anon key after student_states RLS');
  assert(fsrsDue.includes("'apikey': SUPABASE_SERVICE_KEY"), 'fsrs-due sends service key as apikey');
  assert(fsrsDue.includes("'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY"), 'fsrs-due sends service key bearer token');
  assert(fsrsDue.includes('/rest/v1/student_states?'), 'fsrs-due still reads student_states through the server');

  const ingestAttempt = read('api/ingest-attempt.js');
  assert(ingestAttempt.includes('SUPABASE_SERVICE_ROLE_KEY'), 'ingest-attempt uses service role env');
  assert(!ingestAttempt.includes('SUPABASE_ANON_KEY'), 'ingest-attempt must not use anon key after production RLS hardening');
  assert(ingestAttempt.includes("'apikey': SUPABASE_SERVICE_KEY"), 'ingest-attempt sends service key as apikey');
  assert(ingestAttempt.includes("'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY"), 'ingest-attempt sends service key bearer token');
  assert(ingestAttempt.includes('/rest/v1/attempts'), 'ingest-attempt still writes attempts through the server');

  const logDialogue = read('api/log-dialogue.js');
  assert(logDialogue.includes('SUPABASE_SERVICE_ROLE_KEY'), 'log-dialogue uses service role env');
  assert(!logDialogue.includes('SUPABASE_ANON_KEY'), 'log-dialogue must not use anon key after production RLS hardening');
  assert(logDialogue.includes("'apikey': SUPABASE_SERVICE_KEY"), 'log-dialogue sends service key as apikey');
  assert(logDialogue.includes("'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY"), 'log-dialogue sends service key bearer token');
  assert(logDialogue.includes('/rest/v1/dialogues'), 'log-dialogue still writes dialogues through the server');

  const eventApi = read('api/mini/event.js');
  assert(eventApi.includes('mini_learning_events'), 'mini event persists to mini_learning_events when configured');
  assert(eventApi.includes('persistEvent'), 'mini event has a persistence helper');
  assert(eventApi.includes('event_store_failed'), 'mini event exposes stable persistence failure');

  const feedbackApi = read('api/mini/feedback.js');
  assert(feedbackApi.includes('family_priority_feedback'), 'mini feedback persists to family_priority_feedback when configured');
  assert(feedbackApi.includes('persistFeedback'), 'mini feedback has a persistence helper');
  assert(feedbackApi.includes('feedback_store_failed'), 'mini feedback exposes stable persistence failure');

  const savedUrl = process.env.SUPABASE_URL;
  const savedPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const savedAnon = process.env.SUPABASE_ANON_KEY;
  const savedPublicAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  try {
    const q = await callGet('api/get-questions.js', '?topic_code=math.7.ch3.kp3');
    assert.strictEqual(q.status, 503, 'get-questions reports not_configured without service role');
    assert.strictEqual(q.body.error, 'not_configured', 'get-questions exposes stable not_configured code');
    assert(String(q.body.message || '').includes('service_role'), 'get-questions missing env message names service_role');

    const due = await callGet('api/fsrs-due.js', '?student_id=student_1');
    assert.strictEqual(due.status, 503, 'fsrs-due reports not_configured without service role');
    assert.strictEqual(due.body.error, 'not_configured', 'fsrs-due exposes stable not_configured code');
    assert(String(due.body.message || '').includes('service_role'), 'fsrs-due missing env message names service_role');

    const attempt = await callPost('api/ingest-attempt.js', {
      student_id: '00000000-0000-0000-0000-000000000001',
      is_correct: true,
      response: 'first step'
    });
    assert.strictEqual(attempt.status, 503, 'ingest-attempt reports not_configured without service role');
    assert.strictEqual(attempt.body.error, 'not_configured', 'ingest-attempt exposes stable not_configured code');
    assert(String(attempt.body.message || '').includes('SERVICE_ROLE'), 'ingest-attempt missing env message names service role');

    const dialogue = await callPost('api/log-dialogue.js', {
      student_id: '00000000-0000-0000-0000-000000000001',
      role: 'student',
      content: '我第一步先圈条件'
    });
    assert.strictEqual(dialogue.status, 503, 'log-dialogue reports not_configured without service role');
    assert.strictEqual(dialogue.body.error, 'not_configured', 'log-dialogue exposes stable not_configured code');
    assert(String(dialogue.body.message || '').includes('service_role'), 'log-dialogue missing env message names service_role');

    const miniEvent = await callPost('api/mini/event.js', {
      event: 'share_card_generated',
      client_id: 'test-client',
      entity_id: 'share_1',
      payload: { title: 'safe', phone: '13800000000' }
    });
    assert.strictEqual(miniEvent.status, 200, 'mini event returns receipt without service role');
    assert.strictEqual(miniEvent.body.persisted, false, 'mini event does not pretend to persist without service role');
    assert.strictEqual(miniEvent.body.source, 'local_receipt', 'mini event remains honest without service role');

    const miniFeedback = await callPost('api/mini/feedback.js', {
      kind: 'homework_priority',
      target_id: 'priority_1',
      rating: 'accurate',
      bucket: 'must_do',
      calibration_key: 'first_step_order'
    });
    assert.strictEqual(miniFeedback.status, 200, 'mini feedback returns receipt without service role');
    assert.strictEqual(miniFeedback.body.persisted, false, 'mini feedback does not pretend to persist without service role');
    assert.strictEqual(miniFeedback.body.mode, 'local_receipt', 'mini feedback remains honest without service role');
  } finally {
    if (savedUrl == null) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedPublicUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedPublicUrl;
    if (savedService == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedService;
    if (savedAnon == null) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = savedAnon;
    if (savedPublicAnon == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedPublicAnon;
  }

  console.log('RLS API contract passed.');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
