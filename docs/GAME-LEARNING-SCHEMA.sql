-- 原点智学游戏化学习闭环云端持久化建议
-- 当前小程序优先使用本地 Storage + sync queue；启用 Supabase/PostgreSQL 后可按本 schema 落表。
-- 不存储教材 PDF 原文，不生成假社交数据；所有统计来自真实学习事件。

create table if not exists mini_subjects (
  id text primary key,
  name text not null,
  stage text not null check (stage in ('小学', '初中', '高中')),
  created_at timestamptz default now()
);

create table if not exists mini_editions (
  id text primary key,
  subject_id text references mini_subjects(id),
  name text not null,
  publisher text,
  created_at timestamptz default now()
);

create table if not exists mini_knowledge_points (
  id text primary key,
  subject_id text references mini_subjects(id),
  edition_id text references mini_editions(id),
  grade text not null,
  chapter text not null,
  title text not null,
  parent_id text references mini_knowledge_points(id),
  source_ref text,
  created_at timestamptz default now()
);

create table if not exists mini_decks (
  id text primary key,
  client_id text not null,
  title text not null,
  subject text,
  edition text,
  grade text,
  chapter text,
  knowledge_point_id text references mini_knowledge_points(id),
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists mini_flashcards (
  id text primary key,
  deck_id text references mini_decks(id),
  client_id text not null,
  question text not null,
  answer text not null,
  hint text,
  source text,
  knowledge_point_id text references mini_knowledge_points(id),
  repetitions int default 0,
  interval int default 0,
  ease_factor numeric default 2.5,
  next_review timestamptz default now(),
  last_review timestamptz,
  suspended boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists mini_game_profiles (
  client_id text primary key,
  openid_hash text,
  xp int default 0,
  coins int default 0,
  streak int default 0,
  best_streak int default 0,
  last_study_date date,
  streak_freezes int default 0,
  lives int default 5,
  achievements jsonb default '[]'::jsonb,
  inventory jsonb default '[]'::jsonb,
  daily_xp jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table if not exists mini_review_logs (
  id bigserial primary key,
  client_id text not null,
  card_id text references mini_flashcards(id),
  rating text not null,
  xp int default 0,
  weak_point text,
  knowledge_point_id text references mini_knowledge_points(id),
  created_at timestamptz default now(),
  unique (client_id, card_id, created_at)
);

create table if not exists mini_achievements (
  id text primary key,
  title text not null,
  description text,
  coins int default 0,
  created_at timestamptz default now()
);

create table if not exists mini_shop_items (
  id text primary key,
  type text not null,
  title text not null,
  price int not null check (price >= 0),
  description text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists mini_purchase_records (
  id bigserial primary key,
  client_id text not null,
  item_id text references mini_shop_items(id),
  price int not null,
  created_at timestamptz default now()
);

create table if not exists mini_leaderboard_snapshots (
  id bigserial primary key,
  scope text not null check (scope in ('school', 'class', 'friend', 'local')),
  cohort_id text,
  week text not null,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  unique (scope, cohort_id, week)
);

create table if not exists mini_parent_bindings (
  id text primary key,
  child_client_id text not null,
  parent_client_id text,
  bind_code text not null,
  status text not null default 'pending',
  created_at timestamptz default now(),
  confirmed_at timestamptz
);

create index if not exists idx_mini_flashcards_due on mini_flashcards (client_id, next_review);
create index if not exists idx_mini_review_logs_client_time on mini_review_logs (client_id, created_at desc);
create index if not exists idx_mini_review_logs_kp on mini_review_logs (knowledge_point_id);
