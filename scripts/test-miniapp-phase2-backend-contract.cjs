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
  "import knowledgeMap from '../lib/mini-handlers/knowledge-map.js'",
  "import subscriptionReminder from '../lib/mini-handlers/subscription-reminder.js'",
  "from '../lib/mini-handlers/billing.js'",
  "from '../lib/mini-handlers/legal.js'",
  "from '../lib/mini-handlers/admin.js'",
  "'knowledge-map': knowledgeMap",
  "'subscription-reminder': subscriptionReminder",
  "'billing-plans': billingPlans",
  "'pay-wechat-notify': payWechatNotify",
  "'admin-ai-traces': aiTraces"
]);

mustInclude('vercel.json', [
  '/api/mini/knowledge-map',
  '/api/mini/subscription/reminder',
  '/api/mini/billing/plans',
  '/api/mini/billing/order',
  '/api/mini/billing/quota',
  '/api/pay/wechat/notify',
  '/api/mini/legal/privacy',
  '/api/mini/account/delete-request',
  '/api/mini/data/export',
  '/api/admin/users',
  '/api/admin/reports',
  '/api/admin/conversations',
  '/api/admin/ai-traces',
  '/api/admin/feature-flags',
  '/api/admin/qbank/items'
]);

mustInclude('api/mini/tutor-message.js', [
  'mini_ai_traces',
  'replyWithTrace',
  'trace_persisted',
  'no_direct_homework_answer'
]);

mustInclude('lib/mini-handlers/knowledge-map.js', ['mini_knowledge_nodes', 'FALLBACK_MAP', 'service_contract']);
mustInclude('lib/mini-handlers/subscription-reminder.js', ['mini_subscription_reminders', 'wechat_subscription_sender_configuration']);
mustInclude('lib/mini-handlers/billing.js', ['mini_billing_orders', 'mini_billing_quotas', 'WECHAT_PAY_MCH_ID']);
mustInclude('lib/mini-handlers/pay-wechat-notify.js', ['wechatpay-signature', 'wechat_pay_verify_not_configured', 'mini_payment_notifications']);
mustInclude('lib/mini-handlers/legal.js', ['mini_legal_requests', 'delete_account', 'data_export', 'hashShort']);
mustInclude('lib/mini-handlers/admin.js', ['requireAdmin', 'mini_ai_traces', 'mini_feature_flags', 'mini_qbank_items']);
mustInclude('lib/mini-handlers/review-today.js', ['mini_learning_events', 'revisit_schedule', 'day_14']);

mustInclude('supabase/migrations/20260619_mini_phase2_backend_modules.sql', [
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
]);

const vercelIgnore = read('.vercelignore');
const deployedApiFunctions = vercelIgnore
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.startsWith('!api/') && line.endsWith('.js'));
if (deployedApiFunctions.length > 12) failures.push(`.vercelignore: deploys ${deployedApiFunctions.length} functions, must stay <= 12`);

if (failures.length) {
  console.error('Miniapp phase-2 backend contract failed.');
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log('Miniapp phase-2 backend contract passed.');
console.log(`deployedApiFunctions=${deployedApiFunctions.length}`);
