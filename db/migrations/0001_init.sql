-- =============================================================================
-- 原点 AI 私教 · 初始 Schema · v0.1
-- =============================================================================
-- 设计原则：
--   1. 数据源可换 —— 所有外部数据用 (source, source_id) 复合唯一键标识
--   2. 知识点为锚 —— knowledge_points 是核心枢纽，questions/textbook_sections
--      /student_states 都通过 knowledge_point_ids[] 反查
--   3. 软删除审计 —— 全表统一 created_at / updated_at，可加 deleted_at
--   4. 协议风险隔离 —— GPLv3 来源数据（ChinaTextbook）只存 metadata + URL，
--      原始内容不入库
-- =============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- 模糊搜索（题目去重）

-- =============================================================================
-- 枚举类型
-- =============================================================================
create type subject_enum as enum (
  'chinese', 'math', 'english', 'physics', 'chemistry', 'biology',
  'history', 'geography', 'politics', 'science', 'ethics', 'other'
);

create type grade_enum as enum (
  'primary_1','primary_2','primary_3','primary_4','primary_5','primary_6',
  'middle_1','middle_2','middle_3',
  'high_1','high_2','high_3'
);

create type stage_enum as enum ('primary', 'middle', 'high');

create type question_type_enum as enum (
  'mcq_single',      -- 单选
  'mcq_multi',       -- 多选
  'fill_blank',      -- 填空
  'short_answer',    -- 简答
  'open_ended',      -- 开放题
  'cloze',           -- 完形
  'reading_comp',    -- 阅读理解
  'translation',     -- 翻译
  'essay'            -- 作文
);

create type question_source_enum as enum (
  'gaokao_bench',    -- OpenLMLab/GAOKAO-Bench (Apache 2.0)
  'e_eval',          -- AI-EDU-LAB/E-EVAL (MIT)
  'self_authored',   -- 自研题
  'user_uploaded',   -- 用户上传
  'other'
);

create type hint_level_enum as enum ('none', 'light', 'medium', 'strong', 'reveal');

create type misconception_category_enum as enum (
  'concept',         -- 概念错误
  'calculation',     -- 计算错误
  'reading',         -- 审题错误
  'procedure',       -- 步骤错误
  'language',        -- 语言/翻译错误
  'careless',        -- 粗心
  'unknown'
);

create type dialogue_role_enum as enum ('student', 'tutor', 'system', 'tool');

-- =============================================================================
-- 1. knowledge_points · 知识点图谱（CK12 + EDUKG 合并）
-- =============================================================================
-- 来源：tal-tech/chinese-k12-evaluation 584 一级 + 1989 二级
--      THU-KEG/EDUKG 高校知识图谱（补充先修关系）
create table knowledge_points (
  id                   uuid primary key default gen_random_uuid(),
  parent_id            uuid references knowledge_points(id) on delete set null,
  level                int  not null check (level between 1 and 5),  -- 1=一级 2=二级 ...
  subject              subject_enum not null,
  grade                grade_enum,                          -- 可空：跨年级知识点
  stage                stage_enum not null,                 -- 学段（primary/middle/high）
  curriculum_version   text,                                -- 课标版本（如 "2022人教版"）
  name                 text not null,
  description          text,
  prerequisites_ids    uuid[] default '{}',                 -- 先修知识点 ID
  source               text not null default 'ck12',        -- ck12 | edukg | merged
  source_id            text,                                -- 原始来源 ID
  external_refs        jsonb default '{}'::jsonb,           -- 外部引用：{"edukg":"...","wikidata":"..."}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_id)
);

create index idx_kp_subject_stage on knowledge_points(subject, stage);
create index idx_kp_parent on knowledge_points(parent_id);
create index idx_kp_name_trgm on knowledge_points using gin (name gin_trgm_ops);

-- =============================================================================
-- 2. questions · 题库（GAOKAO-Bench / E-EVAL / 自研）
-- =============================================================================
create table questions (
  id                   uuid primary key default gen_random_uuid(),
  source               question_source_enum not null,
  source_id            text not null,                       -- 原数据集 ID
  source_meta          jsonb default '{}'::jsonb,           -- {year, paper_type, region, ...}
  subject              subject_enum not null,
  grade                grade_enum,
  stage                stage_enum not null,
  type                 question_type_enum not null,
  content              text not null,                       -- 题面（含选项）
  options              jsonb,                               -- {"A":"...", "B":"...", ...}
  answer               text not null,                       -- 标准答案（多选用 JSON 数组字符串）
  explanation          text,                                -- 解析
  difficulty           numeric(3,2) check (difficulty between 0 and 1),  -- 0=最易 1=最难
  knowledge_point_ids  uuid[] default '{}',                 -- 标签的知识点
  score               int,                                  -- 原题分值
  language             text default 'zh',
  is_active            boolean not null default true,       -- 软下架
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, source_id)
);

create index idx_q_source on questions(source);
create index idx_q_subject_stage on questions(subject, stage);
create index idx_q_kp on questions using gin (knowledge_point_ids);
create index idx_q_active on questions(is_active) where is_active = true;
create index idx_q_content_trgm on questions using gin (content gin_trgm_ops);  -- 去重

-- =============================================================================
-- 3. textbook_sections · 教材章节锚点（ChinaTextbook）
-- =============================================================================
-- ⚠️ 协议：ChinaTextbook 是 GPLv3
-- 我们只存 metadata + content_url（指向 GitHub raw CDN），不存 PDF 内容本体
create table textbook_sections (
  id                   uuid primary key default gen_random_uuid(),
  textbook             text not null,                       -- "人教版-初中数学"
  publisher            text,                                -- "人民教育出版社"
  edition              text,                                -- "2013版"
  grade                grade_enum not null,
  subject              subject_enum not null,
  stage                stage_enum not null,
  chapter_path         text[] not null,                     -- ["第一章","1.1 节","1.1.2 小节"]
  page_start           int,
  page_end             int,
  content_url          text not null,                       -- raw.githubusercontent.com 直链
  content_hash         text,                                -- PDF SHA256，验证未被替换
  knowledge_point_ids  uuid[] default '{}',
  source               text not null default 'chinatextbook',
  source_meta          jsonb default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (source, textbook, chapter_path)        -- 直接用数组本身做 unique（PG 支持）
);

create index idx_ts_grade_subject on textbook_sections(grade, subject);
create index idx_ts_kp on textbook_sections using gin (knowledge_point_ids);

-- =============================================================================
-- 4. students · 学生档案
-- =============================================================================
create table students (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique,                         -- Supabase auth.users.id
  name                 text not null,
  grade                grade_enum not null,
  stage                stage_enum not null,
  subjects             subject_enum[] default '{}',         -- 在学科目
  birthday             date,
  goals                jsonb default '{}'::jsonb,           -- {"target_score":120,"exam":"中考"}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

create index idx_students_auth on students(auth_user_id);
create index idx_students_grade on students(grade) where deleted_at is null;

-- =============================================================================
-- 5. student_states · 学生认知诊断状态（EduCDM 输出落地）
-- =============================================================================
create table student_states (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  knowledge_point_id   uuid not null references knowledge_points(id) on delete cascade,
  mastery_score        numeric(4,3) not null check (mastery_score between 0 and 1),
  -- 来源模型：dina | irt | ncd | gpt-eval
  model_name           text not null default 'ncd',
  model_version        text,
  confidence           numeric(4,3),                        -- 模型置信度
  attempts_count       int not null default 0,
  correct_count        int not null default 0,
  last_practiced_at    timestamptz,
  next_review_at       timestamptz,                         -- FSRS 下次复习时间
  fsrs_state           jsonb default '{}'::jsonb,           -- {stability, difficulty, retrievability}
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (student_id, knowledge_point_id)
);

create index idx_ss_student on student_states(student_id);
create index idx_ss_kp on student_states(knowledge_point_id);
create index idx_ss_next_review on student_states(next_review_at) where next_review_at is not null;
create index idx_ss_low_mastery on student_states(student_id, mastery_score) where mastery_score < 0.6;

-- =============================================================================
-- 6. attempts · 答题记录
-- =============================================================================
create table attempts (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  question_id          uuid not null references questions(id) on delete restrict,
  session_id           uuid,                                -- 同一次练习的多题
  submitted_at         timestamptz not null default now(),
  response             text not null,                       -- 学生答案
  is_correct           boolean,
  partial_score        numeric(4,3),                        -- 主观题部分对
  time_spent_ms        int,
  hint_level           hint_level_enum not null default 'none',
  hints_used           int not null default 0,
  misconception_id     uuid,                                -- FK 在 misconceptions 表建好后由下方 alter add constraint 挂上
  scored_by            text,                                -- "rule" | "gpt-4" | "human"
  scored_meta          jsonb default '{}'::jsonb,
  knowledge_point_ids  uuid[] default '{}',                 -- 冗余：方便不联表查询
  created_at           timestamptz not null default now()
);

create index idx_attempts_student_time on attempts(student_id, submitted_at desc);
create index idx_attempts_question on attempts(question_id);
create index idx_attempts_session on attempts(session_id);
create index idx_attempts_kp on attempts using gin (knowledge_point_ids);

-- =============================================================================
-- 7. misconceptions · 错误模式库
-- =============================================================================
create table misconceptions (
  id                   uuid primary key default gen_random_uuid(),
  category             misconception_category_enum not null,
  subject              subject_enum,
  knowledge_point_ids  uuid[] default '{}',
  name                 text not null,                       -- "把 (a+b)^2 展开成 a^2+b^2"
  description          text,
  examples             jsonb default '[]'::jsonb,           -- [{q_id, wrong_response, correct}]
  remediation_strategy text,                                -- 纠正建议
  occurrence_count     int not null default 0,              -- 全平台出现次数
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index idx_misc_category on misconceptions(category);
create index idx_misc_kp on misconceptions using gin (knowledge_point_ids);

-- 把 attempts.misconception_id 的外键补上（misconceptions 在它之后建表）
alter table attempts
  add constraint fk_attempts_misconception
  foreign key (misconception_id) references misconceptions(id) on delete set null;

-- =============================================================================
-- 8. dialogues · 对话日志（未来训练数据）
-- =============================================================================
create table dialogues (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references students(id) on delete cascade,
  session_id           uuid not null,
  question_id          uuid references questions(id) on delete set null,
  attempt_id           uuid references attempts(id) on delete set null,
  turn_index           int not null,
  role                 dialogue_role_enum not null,
  content              text not null,
  tool_calls           jsonb,                               -- LLM tool calls
  tokens_in            int,
  tokens_out           int,
  model_name           text,
  latency_ms           int,
  created_at           timestamptz not null default now()
);

create index idx_dialogues_student on dialogues(student_id, created_at desc);
create index idx_dialogues_session on dialogues(session_id, turn_index);
create index idx_dialogues_question on dialogues(question_id) where question_id is not null;

-- =============================================================================
-- 触发器：自动维护 updated_at
-- =============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in select unnest(array[
    'knowledge_points','questions','textbook_sections',
    'students','student_states','misconceptions'
  ]) loop
    execute format('create trigger trg_%s_updated before update on %s
                    for each row execute function set_updated_at()', t, t);
  end loop;
end$$;

-- =============================================================================
-- RLS 策略骨架（Supabase）—— 先开 RLS 占位，具体策略 v0.2 加
-- =============================================================================
alter table students         enable row level security;
alter table student_states   enable row level security;
alter table attempts         enable row level security;
alter table dialogues        enable row level security;

-- 公共数据（题库/知识点/教材）保持 public read，不开 RLS

-- =============================================================================
-- 视图：常用查询
-- =============================================================================
create or replace view v_student_weak_kps as
select
  s.id          as student_id,
  s.name        as student_name,
  s.grade,
  kp.id         as knowledge_point_id,
  kp.name       as kp_name,
  kp.subject,
  ss.mastery_score,
  ss.attempts_count,
  ss.last_practiced_at,
  ss.next_review_at
from student_states ss
  join students s          on s.id = ss.student_id
  join knowledge_points kp on kp.id = ss.knowledge_point_id
where ss.mastery_score < 0.6
  and s.deleted_at is null
order by ss.mastery_score asc;

comment on view v_student_weak_kps is '学生掌握度 < 0.6 的薄弱知识点，按掌握度升序';

-- =============================================================================
-- END
-- =============================================================================
