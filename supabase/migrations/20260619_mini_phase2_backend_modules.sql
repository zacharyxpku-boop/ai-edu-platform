-- Miniapp phase-2 backend modules.
-- Apply from Supabase SQL Editor after phase-1 migration.
-- Client access stays forbidden; Vercel APIs use service_role and explicit admin/session checks.

create table if not exists public.mini_knowledge_nodes (
  knowledge_id text primary key,
  subject text not null,
  grade_band text,
  title text not null,
  parent_id text,
  status text not null default 'active',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_qbank_items (
  item_id text primary key,
  subject text not null,
  grade text,
  knowledge_id text,
  item_type text not null default 'practice',
  prompt_summary text,
  source text not null default 'admin_cms',
  review_status text not null default 'pending_review',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_subscription_reminders (
  reminder_id text primary key,
  user_id text,
  child_id text,
  template_key text not null,
  target_time timestamptz,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.mini_billing_orders (
  order_id text primary key,
  user_id text,
  plan_id text not null,
  amount_cents integer not null default 0,
  status text not null default 'pending_pay',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_billing_quotas (
  user_id text primary key,
  plan_id text not null default 'trial_7d',
  ai_remaining integer not null default 30,
  report_remaining integer not null default 1,
  upload_remaining integer not null default 3,
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_payment_notifications (
  notify_id text primary key,
  provider text not null default 'wechat_pay',
  serial text,
  verified boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mini_legal_requests (
  request_id text primary key,
  user_id text,
  request_type text not null,
  status text not null default 'pending_manual_review',
  contact_hash text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.mini_feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists mini_knowledge_nodes_subject_idx on public.mini_knowledge_nodes (subject, status);
create index if not exists mini_qbank_items_knowledge_idx on public.mini_qbank_items (knowledge_id, review_status);
create index if not exists mini_subscription_reminders_child_idx on public.mini_subscription_reminders (child_id, status, target_time);
create index if not exists mini_billing_orders_user_idx on public.mini_billing_orders (user_id, updated_at desc);
create index if not exists mini_legal_requests_user_idx on public.mini_legal_requests (user_id, created_at desc);

alter table public.mini_knowledge_nodes enable row level security;
alter table public.mini_qbank_items enable row level security;
alter table public.mini_subscription_reminders enable row level security;
alter table public.mini_billing_orders enable row level security;
alter table public.mini_billing_quotas enable row level security;
alter table public.mini_payment_notifications enable row level security;
alter table public.mini_legal_requests enable row level security;
alter table public.mini_feature_flags enable row level security;

drop policy if exists "mini_knowledge_nodes_no_client_read" on public.mini_knowledge_nodes;
create policy "mini_knowledge_nodes_no_client_read" on public.mini_knowledge_nodes for select to anon, authenticated using (false);
drop policy if exists "mini_knowledge_nodes_no_client_write" on public.mini_knowledge_nodes;
create policy "mini_knowledge_nodes_no_client_write" on public.mini_knowledge_nodes for insert to anon, authenticated with check (false);

drop policy if exists "mini_qbank_items_no_client_read" on public.mini_qbank_items;
create policy "mini_qbank_items_no_client_read" on public.mini_qbank_items for select to anon, authenticated using (false);
drop policy if exists "mini_qbank_items_no_client_write" on public.mini_qbank_items;
create policy "mini_qbank_items_no_client_write" on public.mini_qbank_items for insert to anon, authenticated with check (false);

drop policy if exists "mini_subscription_reminders_no_client_read" on public.mini_subscription_reminders;
create policy "mini_subscription_reminders_no_client_read" on public.mini_subscription_reminders for select to anon, authenticated using (false);
drop policy if exists "mini_subscription_reminders_no_client_write" on public.mini_subscription_reminders;
create policy "mini_subscription_reminders_no_client_write" on public.mini_subscription_reminders for insert to anon, authenticated with check (false);

drop policy if exists "mini_billing_orders_no_client_read" on public.mini_billing_orders;
create policy "mini_billing_orders_no_client_read" on public.mini_billing_orders for select to anon, authenticated using (false);
drop policy if exists "mini_billing_orders_no_client_write" on public.mini_billing_orders;
create policy "mini_billing_orders_no_client_write" on public.mini_billing_orders for insert to anon, authenticated with check (false);

drop policy if exists "mini_billing_quotas_no_client_read" on public.mini_billing_quotas;
create policy "mini_billing_quotas_no_client_read" on public.mini_billing_quotas for select to anon, authenticated using (false);
drop policy if exists "mini_billing_quotas_no_client_write" on public.mini_billing_quotas;
create policy "mini_billing_quotas_no_client_write" on public.mini_billing_quotas for insert to anon, authenticated with check (false);

drop policy if exists "mini_payment_notifications_no_client_read" on public.mini_payment_notifications;
create policy "mini_payment_notifications_no_client_read" on public.mini_payment_notifications for select to anon, authenticated using (false);
drop policy if exists "mini_payment_notifications_no_client_write" on public.mini_payment_notifications;
create policy "mini_payment_notifications_no_client_write" on public.mini_payment_notifications for insert to anon, authenticated with check (false);

drop policy if exists "mini_legal_requests_no_client_read" on public.mini_legal_requests;
create policy "mini_legal_requests_no_client_read" on public.mini_legal_requests for select to anon, authenticated using (false);
drop policy if exists "mini_legal_requests_no_client_write" on public.mini_legal_requests;
create policy "mini_legal_requests_no_client_write" on public.mini_legal_requests for insert to anon, authenticated with check (false);

drop policy if exists "mini_feature_flags_no_client_read" on public.mini_feature_flags;
create policy "mini_feature_flags_no_client_read" on public.mini_feature_flags for select to anon, authenticated using (false);
drop policy if exists "mini_feature_flags_no_client_write" on public.mini_feature_flags;
create policy "mini_feature_flags_no_client_write" on public.mini_feature_flags for insert to anon, authenticated with check (false);
