#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const failures = [];

function read(file) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) {
    failures.push(`${file}: missing`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function mustInclude(file, markers) {
  const source = read(file);
  for (const marker of markers) {
    if (!source.includes(marker)) failures.push(`${file}: missing marker ${JSON.stringify(marker)}`);
  }
}

mustInclude('api/mini-dispatch.js', [
  "import me from '../lib/mini-handlers/me.js'",
  "import profileChildren from '../lib/mini-handlers/profile-children.js'",
  "import roleSwitch from '../lib/mini-handlers/role-switch.js'",
  "import event from '../lib/mini-handlers/event.js'",
  "import studentTimeline from '../lib/mini-handlers/student-timeline.js'",
  "import studentPortrait from '../lib/mini-handlers/student-portrait.js'",
  "'profile-children': profileChildren",
  "'role-switch': roleSwitch",
  "'student-timeline': studentTimeline",
  "'student-portrait': studentPortrait"
]);

mustInclude('vercel.json', [
  '/api/mini/me',
  '/api/mini/profile/children',
  '/api/mini/role/switch',
  '/api/mini/event',
  '/api/mini/student/:id/timeline',
  '/api/mini/student/:id/portrait',
  '/api/mini-dispatch?endpoint=me',
  '/api/mini-dispatch?endpoint=event'
]);

mustInclude('lib/mini-store.js', [
  'SUPABASE_SERVICE_ROLE_KEY',
  "client_access: 'forbidden_by_rls'",
  'function scrub',
  'async function upsertRows',
  'async function insertRows',
  'async function selectRows'
]);

for (const file of [
  'lib/mini-handlers/session.js',
  'lib/mini-handlers/me.js',
  'lib/mini-handlers/profile-children.js',
  'lib/mini-handlers/role-switch.js',
  'lib/mini-handlers/sync.js',
  'lib/mini-handlers/event.js',
  'lib/mini-handlers/student-timeline.js',
  'lib/mini-handlers/student-portrait.js',
  'lib/mini-handlers/material-image.js',
  'lib/mini-handlers/learning-report-recognize.js',
  'lib/mini-handlers/report.js',
  'lib/mini-handlers/content-check.js'
]) {
  mustInclude(file, ['service_contract']);
}

mustInclude('lib/mini-handlers/session.js', [
  'jscode2session',
  'openid_hash',
  'mini_sessions',
  'mini_users',
  'wechat_or_database_configuration'
]);

mustInclude('lib/mini-handlers/content-check.js', [
  'mini_ai_traces',
  'blocked: !result.safe',
  'provider: \'local_safety_rules\''
]);

mustInclude('api/report-job-status.js', [
  'mini_report_jobs',
  'publicSupabaseJobPayload',
  'report_job_status_missing',
  'SUPABASE_SERVICE_ROLE_KEY'
]);

mustInclude('supabase/migrations/20260619_mini_phase1_backend_contract.sql', [
  'create table if not exists public.mini_users',
  'create table if not exists public.mini_sessions',
  'create table if not exists public.mini_children',
  'create table if not exists public.mini_sync_mutations',
  'create table if not exists public.mini_materials',
  'create table if not exists public.mini_report_jobs',
  'create table if not exists public.mini_ai_traces',
  'alter table public.mini_learning_events add column if not exists child_id',
  'mini_report_jobs_user_idx',
  'mini_ai_traces_user_idx',
  'enable row level security',
  'with check (false)'
]);

const vercelIgnore = read('.vercelignore');
const deployedApiFunctions = vercelIgnore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('!api/') && line.endsWith('.js'));
if (deployedApiFunctions.length > 12) {
  failures.push(`.vercelignore: deploys ${deployedApiFunctions.length} functions, must stay <= 12`);
}

if (failures.length) {
  console.error('Miniapp phase-1 backend contract failed.');
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('Miniapp phase-1 backend contract passed.');
console.log(`checkedHandlers=12 deployedApiFunctions=${deployedApiFunctions.length}`);
