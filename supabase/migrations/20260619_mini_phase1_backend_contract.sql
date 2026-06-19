-- Miniapp phase-1 backend contract.
-- Apply from Supabase SQL Editor before relying on production persistence.
-- Frontend must not access these tables directly; Vercel APIs write/read with service_role.

create table if not exists public.mini_users (
  user_id text primary key,
  openid_hash text,
  unionid_hash text,
  nickname text,
  avatar_url text,
  active_role text not null default 'parent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_sessions (
  session_id text primary key,
  user_id text not null,
  openid_hash text,
  unionid_hash text,
  client_id text,
  role text not null default 'parent',
  child_id text,
  profile_snapshot jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mini_children (
  child_id text primary key,
  user_id text not null,
  display_name text not null,
  grade text,
  school_stage text,
  status text not null default 'active',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_role_switches (
  switch_id text primary key,
  user_id text,
  role text not null,
  child_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.mini_sync_mutations (
  mutation_id text primary key,
  session_id text,
  user_id text,
  child_id text,
  kind text not null default 'learning_event',
  payload jsonb not null default '{}'::jsonb,
  client_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mini_materials (
  material_id text primary key,
  session_id text,
  user_id text,
  child_id text,
  material_type text not null default 'material',
  storage_bucket text,
  storage_path text,
  status text not null default 'uploaded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mini_report_jobs (
  job_id text primary key,
  session_id text,
  user_id text,
  child_id text,
  status text not null default 'queued',
  source text not null default 'mini-report',
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mini_ai_traces (
  trace_id text primary key,
  session_id text,
  user_id text,
  child_id text,
  endpoint text not null,
  risk_type text not null default 'pass',
  input_summary text,
  output_summary text,
  blocked boolean not null default false,
  sanitized jsonb not null default '{}'::jsonb,
  provider text not null default 'local_safety_rules',
  created_at timestamptz not null default now()
);

create table if not exists public.mini_student_portraits (
  portrait_id text primary key,
  child_id text not null,
  summary jsonb not null default '{}'::jsonb,
  evidence_counts jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.mini_learning_events add column if not exists session_id text;
alter table public.mini_learning_events add column if not exists user_id text;
alter table public.mini_learning_events add column if not exists child_id text;

create index if not exists mini_sessions_user_idx on public.mini_sessions (user_id, created_at desc);
create index if not exists mini_children_user_idx on public.mini_children (user_id, updated_at desc);
create index if not exists mini_sync_child_idx on public.mini_sync_mutations (child_id, created_at desc);
create index if not exists mini_materials_child_idx on public.mini_materials (child_id, created_at desc);
create index if not exists mini_report_jobs_child_idx on public.mini_report_jobs (child_id, updated_at desc);
create index if not exists mini_report_jobs_user_idx on public.mini_report_jobs (user_id, updated_at desc);
create index if not exists mini_report_jobs_status_idx on public.mini_report_jobs (status, updated_at desc);
create index if not exists mini_ai_traces_child_idx on public.mini_ai_traces (child_id, created_at desc);
create index if not exists mini_ai_traces_user_idx on public.mini_ai_traces (user_id, created_at desc);
create index if not exists mini_learning_events_child_received_idx on public.mini_learning_events (child_id, received_at desc);

alter table public.mini_users enable row level security;
alter table public.mini_sessions enable row level security;
alter table public.mini_children enable row level security;
alter table public.mini_role_switches enable row level security;
alter table public.mini_sync_mutations enable row level security;
alter table public.mini_materials enable row level security;
alter table public.mini_report_jobs enable row level security;
alter table public.mini_ai_traces enable row level security;
alter table public.mini_student_portraits enable row level security;

drop policy if exists "mini_users_no_client_read" on public.mini_users;
create policy "mini_users_no_client_read" on public.mini_users for select to anon, authenticated using (false);
drop policy if exists "mini_users_no_client_write" on public.mini_users;
create policy "mini_users_no_client_write" on public.mini_users for insert to anon, authenticated with check (false);

drop policy if exists "mini_sessions_no_client_read" on public.mini_sessions;
create policy "mini_sessions_no_client_read" on public.mini_sessions for select to anon, authenticated using (false);
drop policy if exists "mini_sessions_no_client_write" on public.mini_sessions;
create policy "mini_sessions_no_client_write" on public.mini_sessions for insert to anon, authenticated with check (false);

drop policy if exists "mini_children_no_client_read" on public.mini_children;
create policy "mini_children_no_client_read" on public.mini_children for select to anon, authenticated using (false);
drop policy if exists "mini_children_no_client_write" on public.mini_children;
create policy "mini_children_no_client_write" on public.mini_children for insert to anon, authenticated with check (false);

drop policy if exists "mini_role_switches_no_client_read" on public.mini_role_switches;
create policy "mini_role_switches_no_client_read" on public.mini_role_switches for select to anon, authenticated using (false);
drop policy if exists "mini_role_switches_no_client_write" on public.mini_role_switches;
create policy "mini_role_switches_no_client_write" on public.mini_role_switches for insert to anon, authenticated with check (false);

drop policy if exists "mini_sync_mutations_no_client_read" on public.mini_sync_mutations;
create policy "mini_sync_mutations_no_client_read" on public.mini_sync_mutations for select to anon, authenticated using (false);
drop policy if exists "mini_sync_mutations_no_client_write" on public.mini_sync_mutations;
create policy "mini_sync_mutations_no_client_write" on public.mini_sync_mutations for insert to anon, authenticated with check (false);

drop policy if exists "mini_materials_no_client_read" on public.mini_materials;
create policy "mini_materials_no_client_read" on public.mini_materials for select to anon, authenticated using (false);
drop policy if exists "mini_materials_no_client_write" on public.mini_materials;
create policy "mini_materials_no_client_write" on public.mini_materials for insert to anon, authenticated with check (false);

drop policy if exists "mini_report_jobs_no_client_read" on public.mini_report_jobs;
create policy "mini_report_jobs_no_client_read" on public.mini_report_jobs for select to anon, authenticated using (false);
drop policy if exists "mini_report_jobs_no_client_write" on public.mini_report_jobs;
create policy "mini_report_jobs_no_client_write" on public.mini_report_jobs for insert to anon, authenticated with check (false);

drop policy if exists "mini_ai_traces_no_client_read" on public.mini_ai_traces;
create policy "mini_ai_traces_no_client_read" on public.mini_ai_traces for select to anon, authenticated using (false);
drop policy if exists "mini_ai_traces_no_client_write" on public.mini_ai_traces;
create policy "mini_ai_traces_no_client_write" on public.mini_ai_traces for insert to anon, authenticated with check (false);

drop policy if exists "mini_student_portraits_no_client_read" on public.mini_student_portraits;
create policy "mini_student_portraits_no_client_read" on public.mini_student_portraits for select to anon, authenticated using (false);
drop policy if exists "mini_student_portraits_no_client_write" on public.mini_student_portraits;
create policy "mini_student_portraits_no_client_write" on public.mini_student_portraits for insert to anon, authenticated with check (false);
