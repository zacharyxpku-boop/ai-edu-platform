#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();

const checks = [
  {
    file: 'api/mini/tutor-message.js',
    markers: [
      'COACH_STEP_ALIASES',
      "find_first_step: 'write_first_step'",
      "return 'write_first_step'",
      '../../lib/env.js',
      '../../lib/mini-shared.js'
    ]
  },
  {
    file: 'api/report-job-status.js',
    markers: [
      "runtime: 'nodejs'",
      'report_job_status_missing',
      'report_job_status_invalid'
    ]
  },
  {
    file: 'api/get-questions.js',
    markers: [
      'SUPABASE_SERVICE_ROLE_KEY',
      "'apikey': SUPABASE_SERVICE_KEY",
      "'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY",
      'questions?or=('
    ]
  },
  {
    file: 'api/fsrs-due.js',
    markers: [
      'SUPABASE_SERVICE_ROLE_KEY',
      "'apikey': SUPABASE_SERVICE_KEY",
      "'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY",
      '/rest/v1/student_states?'
    ]
  },
  {
    file: 'api/ingest-attempt.js',
    markers: [
      'SUPABASE_SERVICE_ROLE_KEY',
      "'apikey': SUPABASE_SERVICE_KEY",
      "'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY",
      '/rest/v1/attempts'
    ]
  },
  {
    file: 'api/log-dialogue.js',
    markers: [
      'SUPABASE_SERVICE_ROLE_KEY',
      "'apikey': SUPABASE_SERVICE_KEY",
      "'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY",
      '/rest/v1/dialogues'
    ]
  },
  {
    file: 'api/mini-dispatch.js',
    markers: [
      "'profile-children': profileChildren",
      "'role-switch': roleSwitch",
      "'student-timeline': studentTimeline",
      "'student-portrait': studentPortrait",
      "'knowledge-map': knowledgeMap",
      "'subscription-reminder': subscriptionReminder",
      "'billing-plans': billingPlans",
      "'pay-wechat-notify': payWechatNotify",
      "'admin-ai-traces': aiTraces",
      'event',
      'me',
      "'content-check': contentCheck",
      "'material-image': materialImage",
      "'quiz-generate': quizGenerate",
      "'review-today': reviewToday",
      "'content-engine': contentEngine",
      "'review-grade': reviewGrade",
      "'quiz-submit': quizSubmit",
      "'learning-report-recognize': learningReportRecognize",
      'priority',
      'lead',
      'report',
      'sync',
      'session',
      'weekly'
    ]
  },
  {
    file: 'lib/mini-store.js',
    markers: [
      'SUPABASE_SERVICE_ROLE_KEY',
      "client_access: 'forbidden_by_rls'",
      'async function insertRows',
      'async function upsertRows',
      'async function selectRows'
    ]
  },
  {
    file: 'lib/mini-handlers/session.js',
    markers: [
      'jscode2session',
      'mini_sessions',
      'mini_users',
      'openid_hash',
      'wechat_or_database_configuration'
    ]
  },
  {
    file: 'lib/mini-handlers/me.js',
    markers: [
      'verifySession',
      'mini_children',
      'can_view_report'
    ]
  },
  {
    file: 'lib/mini-handlers/profile-children.js',
    markers: [
      'mini_children',
      'display_name',
      'service_contract'
    ]
  },
  {
    file: 'lib/mini-handlers/role-switch.js',
    markers: [
      'mini_role_switches',
      'can_view_class',
      'bad_role'
    ]
  },
  {
    file: 'lib/mini-handlers/event.js',
    markers: [
      'mini_learning_events',
      'child_id',
      'tutor_to_practice_loop'
    ]
  },
  {
    file: 'lib/mini-handlers/student-timeline.js',
    markers: [
      'mini_learning_events',
      'missing_student_id',
      'empty_state'
    ]
  },
  {
    file: 'lib/mini-handlers/student-portrait.js',
    markers: [
      'mini_student_portraits',
      '不做天赋定论',
      'evidence_counts'
    ]
  },
  {
    file: 'lib/mini-handlers/review-today.js',
    markers: [
      'mini_learning_events',
      'server_event_schedule',
      'revisit_schedule',
      'day_14'
    ]
  },
  {
    file: 'lib/mini-handlers/knowledge-map.js',
    markers: [
      'mini_knowledge_nodes',
      'FALLBACK_MAP',
      'service_contract'
    ]
  },
  {
    file: 'lib/mini-handlers/subscription-reminder.js',
    markers: [
      'mini_subscription_reminders',
      'wechat_subscription_sender_configuration',
      'service_contract'
    ]
  },
  {
    file: 'lib/mini-handlers/billing.js',
    markers: [
      'mini_billing_orders',
      'mini_billing_quotas',
      'WECHAT_PAY_MCH_ID'
    ]
  },
  {
    file: 'lib/mini-handlers/pay-wechat-notify.js',
    markers: [
      'wechatpay-signature',
      'wechat_pay_verify_not_configured',
      'mini_payment_notifications'
    ]
  },
  {
    file: 'lib/mini-handlers/legal.js',
    markers: [
      'mini_legal_requests',
      'delete_account',
      'data_export',
      'hashShort'
    ]
  },
  {
    file: 'lib/mini-handlers/admin.js',
    markers: [
      'requireAdmin',
      'mini_ai_traces',
      'mini_feature_flags',
      'mini_qbank_items'
    ]
  },
  {
    file: 'api/mini/tutor-message.js',
    markers: [
      'replyWithTrace',
      'mini_ai_traces',
      'trace_persisted',
      'no_direct_homework_answer'
    ]
  },
  {
    file: 'lib/mini-handlers/material-image.js',
    markers: [
      '../mini-shared.js',
      '/storage/v1/object/',
      'local_only'
    ]
  },
  {
    file: 'api/mini/qbank-topic.js',
    markers: [
      '../../lib/mini-shared.js',
      'fallback_source',
      'firstStepFromEquation'
    ]
  },
  {
    file: 'api/tutor-chat.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/achievement-quote.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/leaderboard.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/achievements.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/shop/items.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/shop/purchase.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/mini/_game.js',
    markers: [
      'compatibility_retained_safe_copy',
      'retain_reword_safe_copy'
    ]
  },
  {
    file: 'api/mini/shop.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/mini/leaderboard.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/mini/achievements.js',
    markers: [
      'legacy_endpoint_retired',
      'retired_by_default',
      'retire_do_not_expose'
    ]
  },
  {
    file: 'api/mini/event.js',
    markers: [
      '../../lib/mini-shared.js',
      'mini_learning_events',
      'SUPABASE_SERVICE_ROLE_KEY',
      'persistEvent',
      'event_store_failed'
    ]
  },
  {
    file: 'api/mini/feedback.js',
    markers: [
      '../../lib/mini-shared.js',
      'family_priority_feedback',
      'SUPABASE_SERVICE_ROLE_KEY',
      'persistFeedback',
      'feedback_store_failed'
    ]
  },
  {
    file: 'scripts/test-live-miniapp-api-smoke.cjs',
    markers: [
      'assertLiveRetired',
      "check('mini shop retired'",
      "check('mini leaderboard retired'",
      "check('mini achievements retired'",
      "coach_step, 'write_first_step'"
    ]
  },
  {
    file: 'scripts/test-rls-api-contract.cjs',
    markers: [
      'RLS API contract passed',
      'SUPABASE_SERVICE_ROLE_KEY',
      '20260614_harden_rls_after_poc.sql'
    ]
  },
  {
    file: 'supabase/migrations/20260614_mini_learning_persistence.sql',
    markers: [
      'create table if not exists public.mini_learning_events',
      'create table if not exists public.family_priority_feedback',
      'alter table public.mini_learning_events enable row level security',
      'alter table public.family_priority_feedback enable row level security',
      'with check (false)'
    ]
  },
  {
    file: 'supabase/migrations/20260619_mini_phase1_backend_contract.sql',
    markers: [
      'create table if not exists public.mini_users',
      'create table if not exists public.mini_sessions',
      'create table if not exists public.mini_children',
      'create table if not exists public.mini_sync_mutations',
      'create table if not exists public.mini_materials',
      'create table if not exists public.mini_report_jobs',
      'create table if not exists public.mini_ai_traces',
      'alter table public.mini_learning_events add column if not exists child_id',
      'enable row level security',
      'with check (false)'
    ]
  },
  {
    file: 'supabase/migrations/20260619_mini_phase2_backend_modules.sql',
    markers: [
      'create table if not exists public.mini_knowledge_nodes',
      'create table if not exists public.mini_qbank_items',
      'create table if not exists public.mini_subscription_reminders',
      'create table if not exists public.mini_billing_orders',
      'create table if not exists public.mini_billing_quotas',
      'create table if not exists public.mini_payment_notifications',
      'create table if not exists public.mini_legal_requests',
      'create table if not exists public.mini_feature_flags',
      'enable row level security',
      'with check (false)'
    ]
  },
  {
    file: 'supabase/migrations/20260614_harden_rls_after_poc.sql',
    markers: [
      'alter table public.student_states enable row level security',
      'alter table public.questions enable row level security',
      'attempts_server_insert_only',
      'dialogues_server_insert_only',
      'with check (false)'
    ]
  }
];

const failures = [];
const vercelIgnore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
const deployedApiFunctions = vercelIgnore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('!api/') && line.endsWith('.js'))
  .map((line) => line.slice(1));
const requiredApiFunctions = [
  'api/retired.js',
  'api/get-questions.js',
  'api/fsrs-due.js',
  'api/ingest-attempt.js',
  'api/log-dialogue.js',
  'api/report-job-status.js',
  'api/mini-dispatch.js',
  'api/mini/qbank-topic.js',
  'api/mini/event.js',
  'api/mini/feedback.js',
  'api/miniapp-material-analysis.js',
  'api/mini/tutor-message.js'
];

for (const item of checks) {
  const abs = path.join(root, item.file);
  if (!fs.existsSync(abs)) {
    failures.push(`${item.file}: missing required release file`);
    continue;
  }
  const source = fs.readFileSync(abs, 'utf8');
  for (const marker of item.markers) {
    if (!source.includes(marker)) {
      failures.push(`${item.file}: missing marker ${JSON.stringify(marker)}`);
    }
  }
}

if (deployedApiFunctions.length > 12) {
  failures.push(`.vercelignore: deploys ${deployedApiFunctions.length} API functions, must be <= 12 for Vercel Hobby`);
}
for (const apiFile of requiredApiFunctions) {
  if (!deployedApiFunctions.includes(apiFile)) {
    failures.push(`.vercelignore: missing deployed API function ${apiFile}`);
  }
}

if (failures.length) {
  console.error('Miniapp production release scope check failed.');
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('Miniapp production release scope check passed.');
console.log(`checkedFiles=${checks.length}`);
