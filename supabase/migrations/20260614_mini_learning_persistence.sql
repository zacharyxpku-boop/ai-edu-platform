-- Miniapp learning persistence baseline.
-- Apply from Supabase SQL Editor or `supabase db push`.
-- Frontend never talks to these tables directly; Vercel APIs write with service_role.

create table if not exists public.mini_learning_events (
  event_id text primary key,
  client_id text,
  event_name text not null,
  page text,
  source text,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  event_created_at timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists mini_learning_events_client_received_idx
  on public.mini_learning_events (client_id, received_at desc);

create index if not exists mini_learning_events_name_received_idx
  on public.mini_learning_events (event_name, received_at desc);

create index if not exists mini_learning_events_entity_idx
  on public.mini_learning_events (entity_type, entity_id);

create table if not exists public.family_priority_feedback (
  feedback_id text primary key,
  client_id text,
  kind text not null default 'homework_priority',
  target_id text not null,
  rating text not null,
  bucket text,
  reason text,
  item_text text,
  calibration_key text,
  priority_vector jsonb not null default '{}'::jsonb,
  misconception_tags jsonb not null default '[]'::jsonb,
  state_summary jsonb not null default '{}'::jsonb,
  learning_signal jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists family_priority_feedback_target_idx
  on public.family_priority_feedback (target_id, received_at desc);

create index if not exists family_priority_feedback_calibration_idx
  on public.family_priority_feedback (calibration_key, rating, received_at desc);

create index if not exists family_priority_feedback_client_idx
  on public.family_priority_feedback (client_id, received_at desc);

alter table public.mini_learning_events enable row level security;
alter table public.family_priority_feedback enable row level security;

drop policy if exists "mini_learning_events_no_client_read" on public.mini_learning_events;
create policy "mini_learning_events_no_client_read"
  on public.mini_learning_events
  for select
  to anon, authenticated
  using (false);

drop policy if exists "mini_learning_events_no_client_write" on public.mini_learning_events;
create policy "mini_learning_events_no_client_write"
  on public.mini_learning_events
  for insert
  to anon, authenticated
  with check (false);

drop policy if exists "family_priority_feedback_no_client_read" on public.family_priority_feedback;
create policy "family_priority_feedback_no_client_read"
  on public.family_priority_feedback
  for select
  to anon, authenticated
  using (false);

drop policy if exists "family_priority_feedback_no_client_write" on public.family_priority_feedback;
create policy "family_priority_feedback_no_client_write"
  on public.family_priority_feedback
  for insert
  to anon, authenticated
  with check (false);
